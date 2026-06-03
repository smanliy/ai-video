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
  const [wsConnection, setWsConnection] = useState(null); // WebSocket 杩炴帴

  const recentVideos = [
    { name: '瑙嗛鏂囦欢.mp4', date: '浠婂ぉ' },
    { name: '浼氳褰曞儚.mov', date: '鏄ㄥぉ' },
    { name: '鏁欑▼瑙嗛.webm', date: '3澶╁墠' },
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

  const applyVideoResult = async (result) => {
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

    if (videoData.vttPath && videoData.transcript) {
      await parseVTT(videoData.vttPath);
    }

    if (onVideoUpload && videoData.transcript) {
      onVideoUpload(videoData);
    }
  };

  // 瑙ｆ瀽 VTT 瀛楀箷鏂囦欢
  const parseVTT = async (vttPath) => {
    try {
      const fullPath = vttPath.startsWith('http') ? vttPath : `${STATIC_BASE_URL}${vttPath}`;
      console.log('[SidebarLeft] 寮€濮嬭В鏋愬瓧骞曟枃浠?', fullPath);
      
      const response = await fetch(fullPath);
      const text = await response.text();
      console.log('[SidebarLeft] VTT鏂囦欢鍐呭:', text);
      
      const lines = text.split('\n');
      const parsedSubtitles = [];
      let i = 0;
      
      while (i < lines.length) {
        // 璺宠繃 WEBVTT 澶村拰绌鸿
        if (lines[i].trim() === '' || lines[i].startsWith('WEBVTT')) {
          i++;
          continue;
        }
        
        // 瑙ｆ瀽鏃堕棿鎴宠
        const timeLine = lines[i].trim();
        console.log('[SidebarLeft] 妫€鏌ヨ:', timeLine);
        
        // 鏀寔澶氱鏃堕棿鏍煎紡
        const timeMatch = timeLine.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})/) ||
                         timeLine.match(/^(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2})\.(\d{3})/) ||
                         timeLine.match(/^(\d{2}):(\d{2}):(\d{2}) --> (\d{2}):(\d{2}):(\d{2})/);
        
        if (timeMatch) {
          console.log('[SidebarLeft] 鍖归厤鍒版椂闂存埑:', timeMatch);
          
          let startTime, endTime;
          if (timeMatch.length === 9) {
            // 鏍煎紡: 00:00:00.000 --> 00:00:00.000
            startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
            endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
          } else if (timeMatch.length === 7) {
            // 鏍煎紡: 00:00.000 --> 00:00.000 (娌℃湁灏忔椂)
            startTime = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]) + parseInt(timeMatch[3]) / 1000;
            endTime = parseInt(timeMatch[4]) * 60 + parseInt(timeMatch[5]) + parseInt(timeMatch[6]) / 1000;
          } else if (timeMatch.length === 7) {
            // 鏍煎紡: 00:00:00 --> 00:00:00 (娌℃湁姣)
            startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]);
            endTime = parseInt(timeMatch[4]) * 3600 + parseInt(timeMatch[5]) * 60 + parseInt(timeMatch[6]);
          }
          
          i++;
          // 璇诲彇瀛楀箷鏂囨湰锛堝彲鑳借法澶氳锛?
          let textContent = '';
          while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
            textContent += (textContent ? ' ' : '') + lines[i].trim();
            i++;
          }
          
          if (textContent.trim()) {
            parsedSubtitles.push({ startTime, endTime, text: textContent.trim() });
            console.log('[SidebarLeft] 娣诲姞瀛楀箷:', { startTime, endTime, text: textContent.trim() });
          }
        } else {
          i++;
        }
      }
      
      setSubtitles(parsedSubtitles);
      console.log('[SidebarLeft] subtitles parsed:', parsedSubtitles.length);
    } catch (error) {
      console.error('[SidebarLeft] 瑙ｆ瀽瀛楀箷澶辫触:', error);
    }
  };

  // 寤虹珛 WebSocket 杩炴帴
  const connectWebSocket = (fileId) => {
    // 鍏抽棴鏃ц繛鎺?    if (wsConnection) {
      wsConnection.close();
    }

    const serverUrl = SERVER_URL || window.location.origin;
    const wsUrl = serverUrl.startsWith('https')
      ? serverUrl.replace(/^https/, 'wss')
      : serverUrl.replace(/^http/, 'ws');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] 杩炴帴宸插缓绔?);
      // 娉ㄥ唽 fileId
      ws.send(JSON.stringify({ type: 'register', fileId }));
    };

    ws.onmessage = (event) => {
      try {
        const progressData = JSON.parse(event.data);
        console.log('[WebSocket] 杩涘害鏇存柊:', progressData);
        
        // 鏇存柊杩涘害鍜岄樁娈?
        setUploadProgress(progressData.percentage);
        setUploadPhase(progressData.phase);
        if (progressData.phase === 'done' && progressData.result) {
          applyVideoResult(progressData.result).then(() => {
            setIsUploading(false);
            setUploadingFile(null);
            setUploadStatus({ success: true, message: progressData.result.filename + ' 澶勭悊瀹屾垚' });
            setTimeout(() => closeWebSocket(), 1000);
          });
        }
        if (progressData.phase === 'error') {
          setIsUploading(false);
          setUploadingFile(null);
          setUploadStatus({ success: false, message: progressData.message || '澶勭悊澶辫触' });
        }
      } catch (error) {
        console.error('[WebSocket] 瑙ｆ瀽娑堟伅澶辫触:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] 閿欒:', error);
    };

    ws.onclose = () => {
      console.log('[WebSocket] 杩炴帴宸插叧闂?);
      setWsConnection(null);
    };

    setWsConnection(ws);
    return ws;
  };

  // 鍏抽棴 WebSocket 杩炴帴
  const closeWebSocket = () => {
    if (wsConnection) {
      wsConnection.close();
      setWsConnection(null);
    }
  };

  // 缁勪欢鍗歌浇鏃跺叧闂?WebSocket
  useEffect(() => {
    return () => {
      closeWebSocket();
    };
  }, []);

  const handleFileUpload = (file) => {
    console.log('=== 瑙嗛鏂囦欢淇℃伅 ===');
    console.log('鏂囦欢鍚?', file.name);
    console.log('鏂囦欢澶у皬:', formatFileSize(file.size));
    console.log('鏂囦欢绫诲瀷:', file.type);
    console.log('鏈€鍚庝慨鏀规椂闂?', file.lastModifiedDate);
    console.log('=====================');

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus(null);
    setSubtitles([]);
    setUploadPhase('uploading');
    setUploadingFile(file);

    const formData = new FormData()
    formData.append('video', file)

    // 浣跨敤 XMLHttpRequest 瀹炵幇绮剧‘涓婁紶杩涘害
    const xhr = new XMLHttpRequest();
    
    // 涓婁紶杩涘害浜嬩欢
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const uploadPercentage = (e.loaded / e.total) * 100;
        // 涓婁紶闃舵鍗犳€昏繘搴︾殑 30%
        const adjustedProgress = uploadPercentage * 0.3;
        setUploadProgress(Math.round(adjustedProgress));
        console.log(`[涓婁紶杩涘害] ${e.loaded}/${e.total} (${adjustedProgress.toFixed(1)}%)`);
      }
    });

    // 上传成功完成
    xhr.addEventListener('load', () => {
      let keepProcessing = false;
      try {
        const result = JSON.parse(xhr.responseText);

        if (xhr.status === 200) {
          keepProcessing = !!result.processing;
          connectWebSocket(result.fileId);
          applyVideoResult(result);
          setUploadStatus({ success: true, message: result.filename + ' 上传成功，正在处理...' });
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

      if (!keepProcessing) {
        setIsUploading(false);
        setUploadingFile(null);
      }
    });
    // 涓婁紶澶辫触
    xhr.addEventListener('error', () => {
      console.error('缃戠粶閿欒');
      closeWebSocket();
      setUploadStatus({ success: false, message: '缃戠粶杩炴帴澶辫触锛岃妫€鏌ユ湇鍔″櫒鏄惁杩愯' });
      setTimeout(() => {
        setUploadStatus(null);
      }, 3000);
      setIsUploading(false);
      setUploadingFile(null);
    });

    // 涓婁紶琚腑姝?
    xhr.addEventListener('abort', () => {
      console.log('涓婁紶琚彇娑?);
      closeWebSocket();
      setUploadStatus({ success: false, message: '涓婁紶宸插彇娑? });
      setTimeout(() => {
        setUploadStatus(null);
      }, 3000);
      setIsUploading(false);
      setUploadingFile(null);
    });

    // 鍙戦€佽姹?
    xhr.open('POST', `${SERVER_URL}/upload/video`);
    xhr.send(formData);
  };

  // 澶勭悊鏃堕棿鏇存柊
  const handleTimeUpdate = (time) => {
    setCurrentTime(time);
  };

  // 澶勭悊瀛楀箷鐐瑰嚮璺宠浆
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
            閲嶆柊涓婁紶
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
          <h2>涓婁紶瑙嗛</h2>
        </div>
        {renderUploadArea()}
        <div className="divider"></div>

        {/* <RecentVideoList videos={recentVideos} /> */}
      </div>
    </aside>
  )
}

export default SidebarLeft
