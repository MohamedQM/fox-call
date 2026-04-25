package expo.modules.linphonecall

import android.content.Context
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import org.linphone.core.AudioDevice
import org.linphone.core.AuthInfo
import org.linphone.core.Call
import org.linphone.core.Core
import org.linphone.core.CoreListenerStub
import org.linphone.core.Factory
import org.linphone.core.LogLevel
import org.linphone.core.MediaEncryption
import org.linphone.core.ProxyConfig
import org.linphone.core.RegistrationState
import org.linphone.core.TransportType

class StartCallOptions : Record {
  @Field var username: String = ""
  @Field var password: String = ""
  @Field var domain: String = ""
  @Field var port: Int = 5060
  @Field var protocol: String = "tcp"
  @Field var destination: String = ""
  @Field var callLimitSec: Int = 0
}

class LinphoneCallModule : Module() {
  private val TAG = "LinphoneCall"
  private var core: Core? = null
  private var listener: CoreListenerStub? = null
  private val main = Handler(Looper.getMainLooper())

  // Track call state for cleanup
  private var callActive = false
  // Track if core has been started
  private var coreStarted = false

  override fun definition() = ModuleDefinition {
    Name("LinphoneCall")
    Events("onCall")

    AsyncFunction("startCall") { options: StartCallOptions, promise: Promise ->
      try {
        // Clean up any previous call state before starting new call
        cleanupPreviousCall()
        ensureCore()
        directCall(options, promise)
      } catch (e: Throwable) {
        Log.e(TAG, "startCall failed", e)
        emit("failed", e.message ?: "فشل بدء المكالمة")
        callActive = false
        promise.reject("E_START", e.message ?: "start failed", e)
      }
    }

    AsyncFunction("hangup") { promise: Promise ->
      try {
        callActive = false
        val currentCall = core?.currentCall
        if (currentCall != null) {
          currentCall.terminate()
        } else {
          core?.calls?.firstOrNull()?.terminate()
        }
        // Reset audio mode after hangup
        resetAudioMode()
        promise.resolve(null)
      } catch (e: Throwable) {
        promise.reject("E_HANGUP", e.message ?: "hangup failed", e)
      }
    }

    AsyncFunction("setMute") { muted: Boolean, promise: Promise ->
      try {
        core?.isMicEnabled = !muted
        promise.resolve(null)
      } catch (e: Throwable) {
        promise.reject("E_MUTE", e.message ?: "mute failed", e)
      }
    }

    AsyncFunction("setSpeaker") { on: Boolean, promise: Promise ->
      try {
        val ctx = appContext.reactContext ?: throw IllegalStateException("no context")
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        am.mode = AudioManager.MODE_IN_COMMUNICATION
        am.isSpeakerphoneOn = on
        // Try to route audio through Linphone audio device selection
        try {
          val targetType = if (on) AudioDevice.Type.Speaker else AudioDevice.Type.Earpiece
          val device = core?.audioDevices?.firstOrNull {
            it.type == targetType && it.hasCapability(AudioDevice.Capabilities.CapabilityPlay)
          }
          if (device != null) {
            core?.outputAudioDevice = device
            Log.d(TAG, "Audio output set to: ${device.deviceName} (${device.type})")
          } else {
            // Fallback: just use Android AudioManager
            Log.w(TAG, "No Linphone audio device found for type $targetType, using AudioManager fallback")
          }
        } catch (audioErr: Throwable) {
          Log.w(TAG, "Linphone audio device selection failed, using AudioManager: ${audioErr.message}")
        }
        promise.resolve(null)
      } catch (e: Throwable) {
        promise.reject("E_SPK", e.message ?: "speaker failed", e)
      }
    }

    AsyncFunction("sendDtmf") { digit: String, promise: Promise ->
      try {
        val c = core?.currentCall ?: core?.calls?.firstOrNull()
        if (c != null && digit.isNotEmpty()) c.sendDtmf(digit[0])
        promise.resolve(null)
      } catch (e: Throwable) {
        promise.reject("E_DTMF", e.message ?: "dtmf failed", e)
      }
    }

    OnDestroy { teardown() }
  }

  /**
   * Clean up any previous call before starting a new one.
   * This prevents resource leaks and state conflicts.
   */
  private fun cleanupPreviousCall() {
    try {
      core?.let { c ->
        // Terminate any active calls
        c.calls.forEach { try { it.terminate() } catch (_: Throwable) {} }

        // Remove old accounts and auth info
        c.accounts.toList().forEach { try { c.removeAccount(it) } catch (_: Throwable) {} }
        c.authInfoList.toList().forEach { try { c.removeAuthInfo(it) } catch (_: Throwable) {} }
      }
    } catch (e: Throwable) {
      Log.w(TAG, "cleanupPreviousCall warning: ${e.message}")
    }
    callActive = false
  }

  private fun ensureCore() {
    // If core exists and is started, just clean it up for reuse
    if (core != null && coreStarted) {
      Log.d(TAG, "Reusing existing Linphone Core")
      cleanupPreviousCall()
      return
    }

    // Teardown any old core first
    if (core != null) {
      Log.w(TAG, "Core exists but not started properly, recreating")
      teardown()
    }

    val ctx = appContext.reactContext ?: throw IllegalStateException("no context")
    Log.d(TAG, "Creating new Linphone Core")

    Factory.instance().setLogCollectionPath(ctx.filesDir.absolutePath)
    Factory.instance().enableLogCollection(org.linphone.core.LogCollectionState.Enabled)
    Factory.instance().loggingService.setLogLevel(LogLevel.Message)

    val c = Factory.instance().createCore(null, null, ctx)
    c.isNetworkReachable = true

    // Configure audio settings for voice calls
    c.echoCancellationEnabled = true
    c.echoLimiterEnabled = true

    // Disable TLS certificate verification for self-signed certs
    try {
      c.verifyServerCertificates(false)
      c.verifyServerCn(false)
    } catch (e: Throwable) {
      Log.w(TAG, "verifyServerCertificates/Cn not available: ${e.message}")
    }

    // Set up call state listener BEFORE starting core
    val l = object : CoreListenerStub() {
      override fun onCallStateChanged(core: Core, call: Call, state: Call.State, message: String) {
        Log.d(TAG, "Call state: $state ($message)")
        when (state) {
          Call.State.OutgoingInit -> emit("outgoing_init", "جاري الاتصال...")
          Call.State.OutgoingProgress -> emit("outgoing_progress", "جاري الاتصال...")
          Call.State.OutgoingRinging -> emit("ringing", "يرن...")
          Call.State.Connected, Call.State.StreamsRunning -> {
            callActive = true
            emit("connected", "تم الاتصال")
            // Ensure audio is routed properly when connected
            main.post {
              try {
                routeAudioToEarpiece()
              } catch (e: Throwable) {
                Log.w(TAG, "Audio routing failed: ${e.message}")
              }
            }
          }
          Call.State.End, Call.State.Released -> {
            callActive = false
            emit("ended", "انتهت المكالمة")
            // Reset audio mode after call ends
            main.post {
              try { resetAudioMode() } catch (_: Throwable) {}
            }
          }
          Call.State.Error -> {
            callActive = false
            val reason = parseCallError(message)
            Log.e(TAG, "Call error: $reason (raw: $message)")
            emit("failed", reason)
            // Reset audio mode on error
            main.post {
              try { resetAudioMode() } catch (_: Throwable) {}
            }
          }
          else -> {}
        }
      }

      override fun onRegistrationStateChanged(core: Core, cfg: ProxyConfig, state: RegistrationState, message: String) {
        // We don't use registration - direct call only
        Log.d(TAG, "Registration state (ignored): $state ($message)")
      }
    }

    c.addListener(l)
    listener = l
    c.start()
    core = c
    coreStarted = true
    Log.d(TAG, "Linphone Core created and started successfully")
  }

  /**
   * Route audio to earpiece (default for phone calls).
   * Must be called on main thread.
   */
  private fun routeAudioToEarpiece() {
    val ctx = appContext.reactContext ?: return
    val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    // Request audio focus for voice call
    try {
      am.requestAudioFocus(null, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
    } catch (e: Throwable) {
      Log.w(TAG, "Audio focus request failed: ${e.message}")
    }

    am.mode = AudioManager.MODE_IN_COMMUNICATION
    am.isSpeakerphoneOn = false

    // Also try Linphone audio device routing
    try {
      val earpiece = core?.audioDevices?.firstOrNull {
        it.type == AudioDevice.Type.Earpiece && it.hasCapability(AudioDevice.Capabilities.CapabilityPlay)
      }
      if (earpiece != null) {
        core?.outputAudioDevice = earpiece
        Log.d(TAG, "Audio routed to earpiece via Linphone")
      }
    } catch (e: Throwable) {
      Log.w(TAG, "Linphone earpiece routing failed: ${e.message}")
    }
  }

  /**
   * Reset audio mode after call ends.
   */
  private fun resetAudioMode() {
    try {
      val ctx = appContext.reactContext ?: return
      val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      am.mode = AudioManager.MODE_NORMAL
      am.isSpeakerphoneOn = false
      am.abandonAudioFocus(null)
      Log.d(TAG, "Audio mode reset to normal")
    } catch (e: Throwable) {
      Log.w(TAG, "Audio mode reset failed: ${e.message}")
    }
  }

  private fun parseCallError(message: String): String {
    val lower = message.lowercase()
    return when {
      lower.contains("not found") || lower.contains("404") -> "الرقم غير موجود أو الخدمة غير متاحة"
      lower.contains("401") || lower.contains("unauthorized") -> "فشل المصادقة - بيانات SIP غير صالحة"
      lower.contains("403") || lower.contains("forbidden") -> "ممنوع الاتصال - تحقق من الرصيد"
      lower.contains("408") || lower.contains("timeout") || lower.contains("timed out") -> "انتهت مهلة الاتصال - تحقق من الإنترنت"
      lower.contains("480") || lower.contains("temporarily") -> "الرقم مش متاح حالياً"
      lower.contains("486") || lower.contains("busy") -> "الرقم مشغول"
      lower.contains("487") || lower.contains("cancelled") -> "تم إلغاء المكالمة"
      lower.contains("503") || lower.contains("service unavailable") -> "الخدمة غير متاحة حالياً"
      lower.contains("network") || lower.contains("unreachable") -> "لا يمكن الوصول للخادم - تحقق من الإنترنت"
      lower.contains("tls") || lower.contains("ssl") || lower.contains("certificate") -> "مشكلة في الاتصال الآمن"
      lower.contains("declined") || lower.contains("603") -> "تم رفض المكالمة"
      lower.contains("io error") || lower.contains("connection refused") -> "فشل الاتصال بالخادم - تحقق من الإنترنت"
      else -> message.ifEmpty { "فشل الاتصال - حاول مرة أخرى" }
    }
  }

  private fun emit(state: String, reason: String?) {
    main.post {
      try {
        sendEvent("onCall", mapOf("state" to state, "reason" to (reason ?: "")))
      } catch (e: Throwable) {
        Log.w(TAG, "Failed to emit event: ${e.message}")
      }
    }
  }

  /**
   * KEY FIX: Direct call without SIP registration.
   * Telicall SIP servers do not support/require SIP registration.
   * The raw SIP class in callv2.py also connects directly without registration.
   * We create a Linphone account with registration disabled and place the call immediately.
   */
  private fun directCall(o: StartCallOptions, promise: Promise) {
    val c = core ?: throw IllegalStateException("Core not initialized")

    val transport = when (o.protocol.lowercase()) {
      "tls" -> TransportType.Tls
      "tcp" -> TransportType.Tcp
      else -> TransportType.Udp
    }

    // Create SIP identity address: sip:username@domain
    val identityStr = "sip:${o.username}@${o.domain}"
    Log.d(TAG, "Creating identity: $identityStr")
    val identity = Factory.instance().createAddress(identityStr)
    if (identity == null) {
      throw IllegalStateException("فشل إنشاء عنوان SIP - تحقق من بيانات الاتصال")
    }

    // Create proxy/server address: sip:domain:port;transport=proto
    val proxyStr = "sip:${o.domain}:${o.port};transport=${o.protocol.lowercase()}"
    Log.d(TAG, "Creating proxy: $proxyStr")
    val proxyAddr = Factory.instance().createAddress(proxyStr)
    if (proxyAddr == null) {
      throw IllegalStateException("فشل الاتصال بخادم SIP - تأكد من صحة البيانات")
    }

    // Create authentication info for 401/407 challenge responses
    val authInfo = Factory.instance().createAuthInfo(
      o.username,  // username
      null,        // userid (null = same as username)
      o.password,  // password
      null,        // ha1
      null,        // realm
      o.domain     // domain
    )
    c.addAuthInfo(authInfo)
    Log.d(TAG, "Auth info added for user: ${o.username}@${o.domain}")

    // Configure account params with REGISTRATION DISABLED
    val params = c.createAccountParams()
    params.identityAddress = identity
    params.serverAddress = proxyAddr

    // KEY FIX: Disable SIP registration - Telicall servers don't support it
    params.isRegisterEnabled = false

    // Configure transport
    params.transport = transport

    // For TLS: disable media encryption and certificate verification
    if (transport == TransportType.Tls) {
      c.mediaEncryption = MediaEncryption.None
    }

    val account = c.createAccount(params)
    c.addAccount(account)
    c.defaultAccount = account

    Log.d(TAG, "Account created and set as default (registration disabled)")

    // Set up audio mode BEFORE placing the call
    main.post {
      try {
        val ctx = appContext.reactContext
        if (ctx != null) {
          val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
          // Request audio focus
          am.requestAudioFocus(null, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
          am.mode = AudioManager.MODE_IN_COMMUNICATION
          am.isSpeakerphoneOn = false
          Log.d(TAG, "Audio mode set to IN_COMMUNICATION")
        }
      } catch (e: Throwable) {
        Log.w(TAG, "Audio setup failed: ${e.message}")
      }
    }

    // Place the call immediately - no need to wait for registration
    emit("outgoing_init", "جاري الاتصال...")

    try {
      placeCall(o)
      Log.d(TAG, "Call placed successfully")
      promise.resolve(null)
    } catch (e: Throwable) {
      Log.e(TAG, "placeCall failed", e)
      // Clean up audio mode on failure
      main.post { try { resetAudioMode() } catch (_: Throwable) {} }
      emit("failed", e.message ?: "فشل بدء المكالمة")
      promise.reject("E_CALL", e.message ?: "فشل بدء المكالمة", e)
    }
  }

  private fun placeCall(o: StartCallOptions) {
    val c = core ?: throw IllegalStateException("Core not initialized")

    // Normalize destination - remove + prefix
    val dest = o.destination.trim().removePrefix("+")

    // Create call target: sip:number@domain
    val targetStr = "sip:$dest@${o.domain}"
    Log.d(TAG, "Placing call to: $targetStr")

    val callAddr = Factory.instance().createAddress(targetStr)
    if (callAddr == null) {
      throw IllegalStateException("رقم غير صالح: $dest")
    }

    // Create call params
    val callParams = c.createCallParams(null)
    callParams?.mediaEncryption = MediaEncryption.None
    callParams?.enableEarlyMediaSending = true

    // Place the call
    if (callParams != null) {
      c.inviteAddressWithParams(callAddr, callParams)
    } else {
      c.inviteAddress(callAddr)
    }
  }

  private fun teardown() {
    callActive = false
    coreStarted = false
    try {
      core?.let { c ->
        listener?.let { c.removeListener(it) }
        c.calls.forEach { try { it.terminate() } catch (_: Throwable) {} }
        c.stop()
      }
    } catch (_: Throwable) {}
    core = null
    listener = null

    // Reset audio mode
    try { resetAudioMode() } catch (_: Throwable) {}
  }
}
