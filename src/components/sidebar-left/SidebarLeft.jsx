import { useState, useRef, useEffect } from 'react'
import { SERVER_URL, STATIC_BASE_URL } from '../../config'
import UploadDropzone from './UploadDropzone'
import UploadProgress from './UploadProgress'
import UploadStatus from './UploadStatus'
import React from 'react';
import VideoPlayer from '../VideoPlayer'
import SubtitleDisplay from '../SubtitleDisplay'

function SidebarLeft({ onVideoUpload, onVideoRemove, onSegmentsGenerated, jumpToTime, onJumpToTime }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [subtitles, setSubtitles] = useState([]);
  const [uploadPhase, setUploadPhase] = useState(null); // 'uploading', 'transcoding', 'transcribing', 'analyzing', 'done'
  const [uploadingFile, setUploadingFile] = useState(null);
  const [wsConnection, setWsConnection] = useState(null); // WebSocket 连接

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

  // 解析 VTT 字幕文件
  const parseVTT = async (vttPath) => {
    try {
      const fullPath = vttPath.startsWith('http') ? vttPath : `${STATIC_BASE_URL}${vttPath}`;
      console.log('[SidebarLeft] 开始解析字幕文件:', fullPath);
      
      const response = await fetch(fullPath);
      const text = await response.text();
      console.log('[SidebarLeft] VTT文件内容:', text);
      
      const lines = text.split('\n');
      const parsedSubtitles = [];
      let i = 0;
      
      while (i < lines.length) {
        // 跳过 WEBVTT 头和空行
        if (lines[i].trim() === '' || lines[i].startsWith('WEBVTT')) {
          i++;
          continue;
        }
        
        // 解析时间戳行
        const timeLine = lines[i].trim();
        console.log('[SidebarLeft] 检查行:', timeLine);
        
        // 支持多种时间格式
        const timeMatch = timeLine.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})/) ||
                         timeLine.match(/^(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2})\.(\d{3})/) ||
                         timeLine.match(/^(\d{2}):(\d{2}):(\d{2}) --> (\d{2}):(\d{2}):(\d{2})/);
        
        if (timeMatch) {
          console.log('[SidebarLeft] 匹配到时间戳:', timeMatch);
          
          let startTime, endTime;
          if (timeMatch.length === 9) {
            // 格式: 00:00:00.000 --> 00:00:00.000
            startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
            endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
          } else if (timeMatch.length === 7) {
            // 格式: 00:00.000 --> 00:00.000 (没有小时)
            startTime = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]) + parseInt(timeMatch[3]) / 1000;
            endTime = parseInt(timeMatch[4]) * 60 + parseInt(timeMatch[5]) + parseInt(timeMatch[6]) / 1000;
          } else if (timeMatch.length === 7) {
            // 格式: 00:00:00 --> 00:00:00 (没有毫秒)
            startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]);
            endTime = parseInt(timeMatch[4]) * 3600 + parseInt(timeMatch[5]) * 60 + parseInt(timeMatch[6]);
          }
          
          i++;
          // 读取字幕文本（可能跨多行）
          let textContent = '';
          while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
            textContent += (textContent ? ' ' : '') + lines[i].trim();
            i++;
          }
          
          if (textContent.trim()) {
            parsedSubtitles.push({ startTime, endTime, text: textContent.trim() });
            console.log('[SidebarLeft] 添加字幕:', { startTime, endTime, text: textContent.trim() });
          }
        } else {
          i++;
        }
      }
      
      setSubtitles(parsedSubtitles);
      console.log('[SidebarLeft] 解析完成，共', parsedSubtitles.length, '条字幕');
    } catch (error) {
      console.error('[SidebarLeft] 解析字幕失败:', error);
    }
  };

  // 建立 WebSocket 连接
  const connectWebSocket = (fileId) => {
    // 生产环境不支持 WebSocket，直接跳过
    if (import.meta.env.PROD || import.meta.env.MODE === 'production') {
      console.log('[WebSocket] 生产环境不支持 WebSocket，跳过连接');
      setUploadProgress(100);
      setUploadPhase('complete');
      return;
    }

    // 关闭旧连接
    if (wsConnection) {
      wsConnection.close();
    }

    // 创建 WebSocket 连接（仅开发环境）
    const wsUrl = `ws://localhost:3000/`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] 连接已建立');
      // 注册 fileId
      ws.send(JSON.stringify({ type: 'register', fileId }));
    };

    ws.onmessage = (event) => {
      try {
        const progressData = JSON.parse(event.data);
        console.log('[WebSocket] 进度更新:', progressData);
        
        // 更新进度和阶段
        setUploadProgress(progressData.percentage);
        setUploadPhase(progressData.phase);
      } catch (error) {
        console.error('[WebSocket] 解析消息失败:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] 错误:', error);
    };

    ws.onclose = () => {
      console.log('[WebSocket] 连接已关闭');
      setWsConnection(null);
    };

    setWsConnection(ws);
    return ws;
  };

  // 关闭 WebSocket 连接
  const closeWebSocket = () => {
    if (wsConnection) {
      wsConnection.close();
      setWsConnection(null);
    }
  };

  // 组件卸载时关闭 WebSocket
  useEffect(() => {
    return () => {
      closeWebSocket();
    };
  }, []);

  const handleFileUpload = (file) => {
    console.log('=== 视频文件信息 ===');
    console.log('文件名:', file.name);
    console.log('文件大小:', formatFileSize(file.size));
    console.log('文件类型:', file.type);
    console.log('最后修改时间:', file.lastModifiedDate);
    console.log('=====================');

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus(null);
    setSubtitles([]);
    setUploadPhase('uploading');
    setUploadingFile(file);

    const formData = new FormData()
    formData.append('video', file)

    // 使用 XMLHttpRequest 实现精确上传进度
    const xhr = new XMLHttpRequest();
    
    // 上传进度事件
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const uploadPercentage = (e.loaded / e.total) * 100;
        // 上传阶段占总进度的 30%
        const adjustedProgress = uploadPercentage * 0.3;
        setUploadProgress(Math.round(adjustedProgress));
        console.log(`[上传进度] ${e.loaded}/${e.total} (${adjustedProgress.toFixed(1)}%)`);
      }
    });

    // 上传成功完成
    xhr.addEventListener('load', () => {
      try {
        const result = JSON.parse(xhr.responseText);
        
        if (xhr.status === 200) {
          // 上传完成，建立 WebSocket 接收服务器处理进度
          connectWebSocket(result.fileId);

          const videoData = {
            url: `${STATIC_BASE_URL}${result.path}`,
            filename: result.filename,
            size: result.size,
            fileId: result.fileId,
            transcript: result.transcript || '',
            vttPath: result.vttPath || '',
            hls: result.hls || null,
          };

          setUploadedVideo(videoData);

          // 解析字幕
          const parseSubtitles = async () => {
            if (videoData.vttPath) {
              await parseVTT(videoData.vttPath);
            }

            // 等待服务器推送完成状态，然后关闭 WebSocket
            setTimeout(() => {
              closeWebSocket();
            }, 1000);

            if (onVideoUpload) {
              onVideoUpload(videoData);
            }
            setUploadStatus({ success: true, message: result.filename + ' 上传成功' });
          };

          parseSubtitles();
        } else {
          console.error('上传失败:', result.error);
          closeWebSocket();
          setUploadStatus({ success: false, message: result.error });
          setTimeout(() => {
            setUploadStatus(null);
          }, 3000);
        }
      } catch (error) {
        console.error('解析响应失败:', error);
        closeWebSocket();
        setUploadStatus({ success: false, message: '服务器响应格式错误' });
        setTimeout(() => {
          setUploadStatus(null);
        }, 3000);
      }

      setIsUploading(false);
      setUploadingFile(null);
    });

    // 上传失败
    xhr.addEventListener('error', () => {
      console.error('网络错误');
      closeWebSocket();
      setUploadStatus({ success: false, message: '网络连接失败，请检查服务器是否运行' });
      setTimeout(() => {
        setUploadStatus(null);
      }, 3000);
      setIsUploading(false);
      setUploadingFile(null);
    });

    // 上传被中止
    xhr.addEventListener('abort', () => {
      console.log('上传被取消');
      closeWebSocket();
      setUploadStatus({ success: false, message: '上传已取消' });
      setTimeout(() => {
        setUploadStatus(null);
      }, 3000);
      setIsUploading(false);
      setUploadingFile(null);
    });

    // 发送请求
    xhr.open('POST', `${SERVER_URL}/upload/video`);
    xhr.send(formData);
  };

  // 处理时间更新
  const handleTimeUpdate = (time) => {
    setCurrentTime(time);
  };

  // 处理字幕点击跳转
  const handleSubtitleClick = (time) => {
    if (onJumpToTime) {
      onJumpToTime(time);
    }
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
    if (onVideoRemove) {
      onVideoRemove();
    }
  };

  const renderUploadArea = () => {
    if (isUploading && uploadingFile) {
      return (
        <UploadStatus 
          file={uploadingFile} 
          progress={uploadProgress} 
          status={uploadPhase}
        />
      );
    }

    if (uploadedVideo) {
      return (
        <div className="video-preview">
          <VideoPlayer 
            video={uploadedVideo} 
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            onChaptersGenerated={onSegmentsGenerated}
            jumpToTime={jumpToTime}
            onTimeUpdate={handleTimeUpdate}
          />
          <div className="video-info">
            <p className="video-name">{uploadedVideo.filename}</p>
            <p className="video-size">{formatFileSize(uploadedVideo.size)}</p>
          </div>
          {subtitles.length > 0 && (
            <SubtitleDisplay 
              subtitles={subtitles} 
              currentTime={currentTime} 
              onJumpToTime={handleSubtitleClick}
            />
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
