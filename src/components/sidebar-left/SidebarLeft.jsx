import { useState, useRef } from 'react'
import { SERVER_URL } from '../../config'
import UploadDropzone from './UploadDropzone'
import UploadProgress from './UploadProgress'

import VideoPlayer from '../VideoPlayer'

function SidebarLeft() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadedVideo, setUploadedVideo] = useState(null);

  const recentVideos = [
    { name: '视频文件.mp4', date: '今天' },
    { name: '会议录像.mov', date: '昨天' },
    { name: '教程视频.webm', date: '3天前' },
  ]

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }

  const handleFileSelect = (e) => {
    const files = e.target.files
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file) => {
    console.log('=== 视频文件信息 ===');
    console.log('文件名:', file.name);
    console.log('文件大小:', formatFileSize(file.size));
    console.log('文件类型:', file.type);
    console.log('最后修改时间:', file.lastModifiedDate);
    console.log('=====================');

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus(null);

    const formData = new FormData()
    formData.append('video', file)

    try {
      const response = await fetch(`${SERVER_URL}/upload/video`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json()

      if (response.ok) {
        const videoData = {
          url: `${SERVER_URL}${result.path}`,
          filename: result.filename,
          size: result.size,
          fileId: result.fileId,
          transcript: result.transcript || '',
        });
        setUploadStatus({ success: true, message: result.filename + ' 上传成功' });
      } else {
        console.error('上传失败:', result.error);
        setUploadStatus({ success: false, message: result.error });
        setTimeout(() => {
          setUploadStatus(null);
        }, 3000);
      }
    } catch (error) {
      console.error('网络错误:', error);
      setUploadStatus({ success: false, message: '网络连接失败，请检查服务器是否运行' });
      setTimeout(() => {
        setUploadStatus(null);
      }, 3000);
    }

    setIsUploading(false);
    setUploadProgress(100);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleReupload = () => {
    setUploadedVideo(null);
    setUploadStatus(null);
  };

  const videoRef = useRef(null);

  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }

    console.log('视频播放/暂停 点击了！');
  };

  const renderUploadArea = () => {
    if (isUploading) {
      return <UploadProgress progress={uploadProgress} />;
    }

    if (uploadedVideo) {
      return (
        <div className="video-preview">
          <video
            ref={videoRef}
            className="preview-video"
            src={uploadedVideo.url}
            controls
            autoPlay
            muted
            playsInline
            onClick={handleVideoClick}
          />
          <div className="video-info">
            <p className="video-name">{uploadedVideo.filename}</p>
            <p className="video-size">{formatFileSize(uploadedVideo.size)}</p>
          </div>
          {uploadedVideo.transcript && uploadedVideo.transcript !== '语音识别失败' && (
            <div className="video-transcript">
              <h4>语音识别结果</h4>
              <p>{uploadedVideo.transcript}</p>
            </div>
          )}
          <button className="reupload-btn" onClick={handleReupload}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            重新上传
          </button>
        </div>
      );
    }

    if (uploadStatus) {
      const statusClass = uploadStatus.success ? 'success' : 'error';
      return (
        <div className={`upload-status ${statusClass}`}>
          {uploadStatus.success ? (
            <React.Fragment>
              <svg className="status-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{uploadStatus.message}</span>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <svg className="status-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>{uploadStatus.message}</span>
            </React.Fragment>
          )}
        </div>
      );
    }

    return (
      <UploadDropzone
        isDragging={isDragging}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onFileSelect={handleFileSelect}
      />
    );
  };

  return (
    <aside className="sidebar-left">
      <div className="panel">
        <div className="panel-header">
          <h2>上传视频</h2>
        </div>
        {renderUploadArea()}
        <div className="divider"></div>

        {/* <RecentVideoList videos={recentVideos} /> */}
      </div>
    </aside>
  )
}

export default SidebarLeft
