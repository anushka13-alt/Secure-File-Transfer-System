// WebRTC Client Module
class WebRTCCall {
  constructor(socket, sessionId, localVideoElement, remoteVideoElement) {
    this.socket = socket;
    this.sessionId = sessionId;
    this.localVideo = localVideoElement;
    this.remoteVideo = remoteVideoElement;
    this.peerConnection = null;
    this.localStream = null;
    this.isCallActive = false;
    this.isMicEnabled = true;
    this.isCameraEnabled = true;
    
    // STUN servers (free, for peer discovery)
    this.configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };
    
    this.setupSocketListeners();
  }
  
  setupSocketListeners() {
    this.socket.on('offer', async ({ offer, fromId }) => {
      await this.handleOffer(offer, fromId);
    });
    
    this.socket.on('answer', async ({ answer }) => {
      await this.handleAnswer(answer);
    });
    
    this.socket.on('ice-candidate', async ({ candidate }) => {
      await this.handleIceCandidate(candidate);
    });
    
    this.socket.on('user-left', ({ userId }) => {
      this.handleUserLeft(userId);
    });
    
    this.socket.on('mic-toggled', ({ userId, enabled }) => {
      this.updateUserMicStatus(userId, enabled);
    });
    
    this.socket.on('camera-toggled', ({ userId, enabled }) => {
      this.updateUserCameraStatus(userId, enabled);
    });
  }
  
  async startCall() {
    try {
      // Get user media (camera + microphone)
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      this.localVideo.srcObject = this.localStream;
      
      // Create peer connection
      this.createPeerConnection();
      
      // Add local tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
      
      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.socket.emit('offer', {
        sessionId: this.sessionId,
        offer: offer,
        targetId: null  // Broadcast to all in room
      });
      
      this.isCallActive = true;
      return true;
    } catch (error) {
      console.error('Error starting call:', error);
      return false;
    }
  }
  
  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.configuration);
    
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          sessionId: this.sessionId,
          candidate: event.candidate,
          targetId: null
        });
      }
    };
    
    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      this.remoteVideo.srcObject = event.streams[0];
    };
    
    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      if (this.peerConnection.connectionState === 'connected') {
        this.showNotification('Call connected!');
      } else if (this.peerConnection.connectionState === 'disconnected') {
        this.showNotification('Call disconnected');
      }
    };
  }
  
  async handleOffer(offer, fromId) {
    if (!this.peerConnection) {
      this.createPeerConnection();
    }
    
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    // Get local media if not already
    if (!this.localStream) {
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      this.localVideo.srcObject = this.localStream;
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }
    
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    this.socket.emit('answer', {
      sessionId: this.sessionId,
      answer: answer,
      targetId: fromId
    });
    
    this.isCallActive = true;
  }
  
  async handleAnswer(answer) {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
  
  async handleIceCandidate(candidate) {
    if (this.peerConnection) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }
  
  handleUserLeft(userId) {
    console.log(`User ${userId} left the call`);
    this.showNotification('Other user left the call');
    // Optionally stop the call
  }
  
  toggleMic() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        this.isMicEnabled = !this.isMicEnabled;
        audioTrack.enabled = this.isMicEnabled;
        this.socket.emit('toggle-mic', {
          sessionId: this.sessionId,
          enabled: this.isMicEnabled
        });
        return this.isMicEnabled;
      }
    }
    return false;
  }
  
  toggleCamera() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        this.isCameraEnabled = !this.isCameraEnabled;
        videoTrack.enabled = this.isCameraEnabled;
        this.socket.emit('toggle-camera', {
          sessionId: this.sessionId,
          enabled: this.isCameraEnabled
        });
        return this.isCameraEnabled;
      }
    }
    return false;
  }
  
  endCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.localVideo.srcObject = null;
    this.remoteVideo.srcObject = null;
    this.isCallActive = false;
    
    this.socket.emit('leave-call', { sessionId: this.sessionId });
  }
  
  updateUserMicStatus(userId, enabled) {
    // Update UI to show microphone status
    console.log(`User ${userId} microphone ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  updateUserCameraStatus(userId, enabled) {
    // Update UI to show camera status
    console.log(`User ${userId} camera ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  showNotification(message) {
    // Use your existing toast notification system
    if (typeof showToast === 'function') {
      showToast(message, 'info');
    } else {
      console.log('Notification:', message);
    }
  }
}

// Export for use in HTML
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebRTCCall;
}