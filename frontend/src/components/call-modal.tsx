import { useEffect, useRef, useState, useCallback } from "react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Loader2, PhoneMissed } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || res.statusText);
  return json;
}

export interface CallPeer {
  id: number;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

interface CallModalProps {
  peer: CallPeer;
  conversationId: number;
  callType: "audio" | "video";
  mode: "outgoing" | "incoming";
  incomingCallId?: number;
  incomingSdpOffer?: string;
  onClose: () => void;
}

type CallStatus = "connecting" | "ringing" | "active" | "ended" | "rejected" | "failed";

export function CallModal({ peer, conversationId, callType, mode, incomingCallId, incomingSdpOffer, onClose }: CallModalProps) {
  const [status, setStatus] = useState<CallStatus>(mode === "outgoing" ? "connecting" : "ringing");
  const [callId, setCallId] = useState<number | null>(incomingCallId || null);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceBatchRef = useRef<RTCIceCandidate[]>([]);
  const iceSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    if (iceSendTimerRef.current) clearTimeout(iceSendTimerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
  }, []);

  const endCall = useCallback(async (rejected = false) => {
    if (callId) {
      try { await apiFetch(`/calls/${callId}/end`, { method: "POST", body: JSON.stringify({ rejected }) }); } catch {}
    }
    cleanup();
    onClose();
  }, [callId, cleanup, onClose]);

  const sendIceCandidates = useCallback(async (candidates: RTCIceCandidate[], cId: number) => {
    for (const c of candidates) {
      try { await apiFetch(`/calls/${cId}/ice`, { method: "POST", body: JSON.stringify({ candidate: c.toJSON() }) }); } catch {}
    }
  }, []);

  const createPeerConnection = useCallback((cId: number, isCaller: boolean) => {
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    pcRef.current = pc;

    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      iceBatchRef.current.push(e.candidate);
      if (iceSendTimerRef.current) clearTimeout(iceSendTimerRef.current);
      iceSendTimerRef.current = setTimeout(() => {
        const batch = [...iceBatchRef.current];
        iceBatchRef.current = [];
        sendIceCandidates(batch, cId);
      }, 500);
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setStatus("active");
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      }
      if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
        if (status !== "ended") endCall();
      }
    };

    // Poll for remote ICE candidates and status
    let prevIceLen = 0;
    pollRef.current = setInterval(async () => {
      try {
        const d = await apiFetch(`/calls/${cId}`);
        const call = d.call;

        if (["ended", "rejected"].includes(call.status)) {
          setStatus(call.status);
          cleanup();
          setTimeout(onClose, 1500);
          return;
        }

        if (!isCaller && call.status === "active" && call.sdpAnswer && pc.signalingState === "have-local-offer") {
          // This shouldn't happen here but handle gracefully
        }

        if (isCaller && call.sdpAnswer && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: call.sdpAnswer }));
        }

        const remoteCandidates: any[] = isCaller ? (call.calleeIce || []) : (call.callerIce || []);
        if (remoteCandidates.length > prevIceLen) {
          for (let i = prevIceLen; i < remoteCandidates.length; i++) {
            try { await pc.addIceCandidate(new RTCIceCandidate(remoteCandidates[i])); } catch {}
          }
          prevIceLen = remoteCandidates.length;
        }
      } catch {}
    }, 1500);

    return pc;
  }, [sendIceCandidates, cleanup, onClose, status, endCall]);

  // Outgoing call: get media → create offer → start
  useEffect(() => {
    if (mode !== "outgoing") return;

    (async () => {
      try {
        const constraints = callType === "video"
          ? { audio: true, video: true }
          : { audio: true, video: false };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = createPeerConnection(0, true); // temp 0, will update after start
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const d = await apiFetch("/calls/start", {
          method: "POST",
          body: JSON.stringify({ conversationId, callType, sdpOffer: offer.sdp }),
        });
        const newCallId = d.call.id;
        setCallId(newCallId);
        setStatus("ringing");

        // Re-attach ICE send with real callId
        pc.onicecandidate = (e) => {
          if (!e.candidate) return;
          iceBatchRef.current.push(e.candidate);
          if (iceSendTimerRef.current) clearTimeout(iceSendTimerRef.current);
          iceSendTimerRef.current = setTimeout(() => {
            const batch = [...iceBatchRef.current];
            iceBatchRef.current = [];
            sendIceCandidates(batch, newCallId);
          }, 500);
        };

        // Poll for answer
        if (pollRef.current) clearInterval(pollRef.current);
        let prevIceLen = 0;
        pollRef.current = setInterval(async () => {
          try {
            const pd = await apiFetch(`/calls/${newCallId}`);
            const call = pd.call;

            if (["ended", "rejected"].includes(call.status)) {
              setStatus(call.status as CallStatus);
              cleanup();
              setTimeout(onClose, 1500);
              return;
            }

            if (call.sdpAnswer && pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: call.sdpAnswer }));
            }

            const remoteCandidates: any[] = call.calleeIce || [];
            if (remoteCandidates.length > prevIceLen) {
              for (let i = prevIceLen; i < remoteCandidates.length; i++) {
                try { await pc.addIceCandidate(new RTCIceCandidate(remoteCandidates[i])); } catch {}
              }
              prevIceLen = remoteCandidates.length;
            }
          } catch {}
        }, 1500);

      } catch (err: any) {
        setError("Mikrofon/kamera erişimi sağlanamadı");
        setStatus("failed");
      }
    })();

    return cleanup;
  }, []);

  // Incoming call: just show ringing UI, wait for user to accept/reject
  // (media starts only on accept)

  const acceptCall = useCallback(async () => {
    if (!incomingCallId || !incomingSdpOffer) return;
    setStatus("connecting");
    try {
      const constraints = callType === "video"
        ? { audio: true, video: true }
        : { audio: true, video: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      pcRef.current = pc;

      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      pc.ontrack = (e) => {
        if (remoteVideoRef.current && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setStatus("active");
          timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        }
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          if (status !== "ended") endCall();
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: incomingSdpOffer }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await apiFetch(`/calls/${incomingCallId}/answer`, {
        method: "POST",
        body: JSON.stringify({ sdpAnswer: answer.sdp }),
      });

      // ICE
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        iceBatchRef.current.push(e.candidate);
        if (iceSendTimerRef.current) clearTimeout(iceSendTimerRef.current);
        iceSendTimerRef.current = setTimeout(() => {
          const batch = [...iceBatchRef.current];
          iceBatchRef.current = [];
          sendIceCandidates(batch, incomingCallId);
        }, 500);
      };

      // Poll for caller ICE
      let prevIceLen = 0;
      pollRef.current = setInterval(async () => {
        try {
          const pd = await apiFetch(`/calls/${incomingCallId}`);
          const call = pd.call;
          if (["ended"].includes(call.status)) {
            setStatus("ended");
            cleanup();
            setTimeout(onClose, 1500);
            return;
          }
          const callerCandidates: any[] = call.callerIce || [];
          if (callerCandidates.length > prevIceLen) {
            for (let i = prevIceLen; i < callerCandidates.length; i++) {
              try { await pc.addIceCandidate(new RTCIceCandidate(callerCandidates[i])); } catch {}
            }
            prevIceLen = callerCandidates.length;
          }
        } catch {}
      }, 1500);

    } catch (err) {
      setError("Mikrofon/kamera erişimi sağlanamadı");
      setStatus("failed");
    }
  }, [incomingCallId, incomingSdpOffer, callType, sendIceCandidates, cleanup, onClose, endCall, status]);

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = videoOff; });
    setVideoOff(v => !v);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const statusLabel: Record<CallStatus, string> = {
    connecting: "Bağlanıyor...",
    ringing: mode === "outgoing" ? "Çağrılıyor..." : `${callType === "video" ? "Görüntülü" : "Sesli"} arama geliyor`,
    active: formatDuration(duration),
    ended: "Arama bitti",
    rejected: "Arama reddedildi",
    failed: error || "Bağlantı başarısız",
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-sm mx-4 rounded-3xl overflow-hidden bg-gradient-to-b from-[#1a1a2e] to-[#0e0e1a] border border-white/10 shadow-2xl">

        {/* Remote video (background when video call) */}
        {callType === "video" && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
        )}

        {/* Overlay content */}
        <div className="relative z-10 flex flex-col items-center pt-12 pb-8 px-6 min-h-[420px]">
          {/* Peer info */}
          <div className="relative mb-4">
            <div className={cn(
              "absolute inset-0 rounded-full",
              status === "ringing" && "animate-ping bg-primary/30"
            )} />
            <Avatar className="h-24 w-24 border-4 border-white/10 shadow-xl">
              <AvatarImage src={peer.avatarUrl || ""} />
              <AvatarFallback className="text-2xl bg-primary/20">
                {(peer.displayName || peer.username).substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <h2 className="text-xl font-bold text-white mb-1">{peer.displayName || peer.username}</h2>
          <p className="text-sm text-white/60 mb-2">@{peer.username}</p>

          <div className="flex items-center gap-2 mb-8">
            {status === "connecting" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {status === "ended" && <PhoneMissed className="h-4 w-4 text-red-400" />}
            <span className={cn(
              "text-sm font-medium",
              status === "active" ? "text-green-400 font-mono text-base" : "text-white/70"
            )}>
              {statusLabel[status]}
            </span>
          </div>

          {/* Local video pip */}
          {callType === "video" && status === "active" && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute top-4 right-4 w-24 h-16 object-cover rounded-xl border border-white/20 shadow-lg"
            />
          )}

          {/* Controls */}
          <div className="flex items-center gap-4 mt-auto">
            {/* Incoming: Accept / Reject */}
            {mode === "incoming" && status === "ringing" && (
              <>
                <button
                  onClick={() => endCall(true)}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all active:scale-95"
                >
                  <PhoneOff className="h-7 w-7 text-white" />
                </button>
                <button
                  onClick={acceptCall}
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg transition-all active:scale-95 animate-bounce"
                >
                  <Phone className="h-7 w-7 text-white" />
                </button>
              </>
            )}

            {/* Active call controls */}
            {status === "active" && (
              <>
                <button
                  onClick={toggleMute}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95",
                    muted ? "bg-red-500/80 text-white" : "bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>

                {callType === "video" && (
                  <button
                    onClick={toggleVideo}
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95",
                      videoOff ? "bg-red-500/80 text-white" : "bg-white/10 text-white hover:bg-white/20"
                    )}
                  >
                    {videoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                  </button>
                )}

                <button
                  onClick={() => endCall(false)}
                  className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all active:scale-95"
                >
                  <PhoneOff className="h-6 w-6 text-white" />
                </button>
              </>
            )}

            {/* Outgoing ringing */}
            {mode === "outgoing" && (status === "ringing" || status === "connecting") && (
              <button
                onClick={() => endCall(false)}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all active:scale-95"
              >
                <PhoneOff className="h-7 w-7 text-white" />
              </button>
            )}

            {/* Ended state */}
            {["ended", "rejected", "failed"].includes(status) && (
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all"
              >
                Kapat
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
