import { useState, useEffect, useRef } from 'react';

function UploadStatus({ file, progress, status }) {
  const [thumbnail, setThumbnail] = useState(null);
  const videoRef = useRef(null);

  // 生成视频第一帧快照
  useEffect(() => {
    if (file && file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      
      video.onloadedmetadata = () => {
        video.currentTime = 1; // 获取第一秒的帧
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setThumbnail(canvas.toDataURL('image/jpeg', 0.8));
        URL.revokeObjectURL(video.src);
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
      };
    }
  }, [file]);

  const getStatusText = () => {
    switch (status) {
      case 'uploading':
        return '📤 上传中...';
      case 'transcoding':
        return '🔄 转码中...';
      case 'transcribing':
        return '🎤 转录字幕中...';
      case 'analyzing':
        return '🧠 分析视频内容...';
      case 'done':
        return '✅ 完成';
      default:
        return '⏳ 处理中...';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'uploading':
        return '#3b82f6'; // blue
      case 'transcoding':
        return '#f59e0b'; // amber
      case 'transcribing':
        return '#8b5cf6'; // purple
      case 'analyzing':
        return '#10b981'; // emerald
      case 'done':
        return '#10b981'; // green
      default:
        return '#6b7280'; // gray
    }
  };

  return (
    <div className="upload-status-container">
      {/* 视频快照 */}
      <div className="video-thumbnail">
        {thumbnail ? (
          <img 
            src={thumbnail} 
            alt="视频快照" 
            className="thumbnail-image"
          />
        ) : (
          <div className="thumbnail-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M15 15l5 5" />
              <circle cx="10" cy="10" r="3" />
            </svg>
            <span>正在生成预览...</span>
          </div>
        )}
        
        {/* 加载动画覆盖层 */}
        <div className="thumbnail-overlay">
          <div className="spinner"></div>
        </div>
      </div>

      {/* 文件名 */}
      <div className="file-info">
        <span className="file-name">{file?.name}</span>
        <span className="file-size">
          {file && (file.size / 1024 / 1024).toFixed(2)} MB
        </span>
      </div>

      {/* 状态文字 */}
      <div className="status-text" style={{ color: getStatusColor() }}>
        {getStatusText()}
      </div>

      {/* 进度条 */}
      <div className="progress-container">
        <div 
          className="progress-bar" 
          style={{ 
            width: `${progress}%`,
            backgroundColor: getStatusColor()
          }}
        />
        <span className="progress-percentage">{progress}%</span>
      </div>

      {/* 进度阶段指示 */}
      <div className="progress-stages">
        <div className={`stage ${status === 'uploading' || status === 'transcoding' || status === 'transcribing' || status === 'analyzing' || status === 'done' ? 'active' : ''}`}>
          <span className="stage-dot"></span>
          <span className="stage-label">上传</span>
        </div>
        <div className={`stage ${status === 'transcoding' || status === 'transcribing' || status === 'analyzing' || status === 'done' ? 'active' : ''}`}>
          <span className="stage-dot"></span>
          <span className="stage-label">转码</span>
        </div>
        <div className={`stage ${status === 'transcribing' || status === 'analyzing' || status === 'done' ? 'active' : ''}`}>
          <span className="stage-dot"></span>
          <span className="stage-label">转录</span>
        </div>
        <div className={`stage ${status === 'analyzing' || status === 'done' ? 'active' : ''}`}>
          <span className="stage-dot"></span>
          <span className="stage-label">分析</span>
        </div>
        <div className={`stage ${status === 'done' ? 'active' : ''}`}>
          <span className="stage-dot"></span>
          <span className="stage-label">完成</span>
        </div>
      </div>
    </div>
  );
}

export default UploadStatus;
