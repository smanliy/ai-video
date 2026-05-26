import { useRef, useEffect, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import '@videojs/http-streaming';
import 'videojs-contrib-quality-menu';
import 'videojs-contrib-quality-menu/dist/videojs-contrib-quality-menu.css';
import { SERVER_URL } from '../config';

export default function VideoPlayer({ video, isUploading, uploadProgress, onVideoReady, onChaptersGenerated, previewImage, jumpToTime }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  useEffect(() => {
    // 使用 setTimeout 避免同步 setState 警告
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 0);
    
    return () => {
      clearTimeout(timer);
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (!video) {
      console.warn('[VideoPlayer] video prop 为空，跳过初始化');
      return;
    }
    
    console.log('[VideoPlayer] === 开始初始化播放器 ===');
    console.log('[VideoPlayer] video prop:', video);
    
    const videoElement = videoRef.current;
    if (!videoElement) {
      console.warn('[VideoPlayer] videoRef.current 为 null');
      return;
    }

    if (!document.body.contains(videoElement)) {
      console.warn('[VideoPlayer] video 元素不在 DOM 中');
      return;
    }

    try {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        console.log('[VideoPlayer] 清理旧播放器');
        playerRef.current.dispose();
        playerRef.current = null;
      }

      const player = videojs(videoElement, {
        autoplay: false,
        controls: true,
        responsive: true,
        fluid: true,
        preload: 'auto',
        playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
        controlBar: {
          children: [
            'playToggle',
            'volumePanel',
            'currentTimeDisplay',
            'timeDivider',
            'durationDisplay',
            'progressControl',
            'playbackRateMenuButton',
            'qualityMenu',
            'chaptersButton',
            'pictureInPictureToggle',
            'fullscreenToggle'
          ]
        }
      });

      playerRef.current = player;

      const handleCanPlay = () => {
        console.log('[VideoPlayer] canplay 事件触发');
        setIsVideoLoaded(true);
        if (onVideoReady) {
          onVideoReady();
        }
      };

      const handleError = (e) => {
        console.error('[VideoPlayer] 视频播放错误:', e);
        setError('视频加载失败，请检查网络连接或视频格式');
      };

      player.on('canplay', handleCanPlay);
      player.on('error', handleError);
      
      // 在播放器初始化时就添加 loadedmetadata 监听
      const handleMetadataInit = () => {
        console.log('[VideoPlayer] === loadedmetadata 事件触发 ===');
        const duration = player.duration();
        console.log(`[VideoPlayer] 视频时长: ${duration}`);
        console.log(`[VideoPlayer] video 对象:`, video);
        console.log(`[VideoPlayer] video.transcript:`, video?.transcript ? `有内容 (${video.transcript.length}字符)` : '空或undefined');
        console.log(`[VideoPlayer] video.chapterVttPath:`, video?.chapterVttPath);
        
        if (video && video.transcript && !video.chapterVttPath) {
          console.log('[VideoPlayer] 开始调用 /api/generate-chapters');
          fetch(SERVER_URL + '/api/generate-chapters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: video.fileId, transcript: video.transcript, duration })
          })
          .then(res => res.json())
          .then(data => {
            console.log('[VideoPlayer] 章节生成返回:', data);
            if (data.success) {
              const chapterSrc = data.chapterVttPath.startsWith('http') ? data.chapterVttPath : SERVER_URL + data.chapterVttPath;
              player.addRemoteTextTrack({
                kind: 'chapters',
                src: chapterSrc,
                srclang: 'zh',
                label: '章节',
                mode:'showing'
              }, true);
              console.log('chaptersrc',chapterSrc)
              if (onChaptersGenerated) {
                // 传递完整数据（包含 summary 和 segments）
                onChaptersGenerated({
                  summary: data.summary || '暂无总结',
                  segments: data.segments || []
                });
              }
            }
          })
          .catch(err => console.error('[VideoPlayer] 章节生成失败:', err));
        }
      };
      
      player.on('loadedmetadata', handleMetadataInit);
      
      // 在播放器初始化后立即设置视频源
      console.log('[VideoPlayer] === 开始设置视频源 ===');
      const src = video.hls?.masterPlaylistUrl || video.path || video.url;
      if (!src) {
        console.error('[VideoPlayer] 视频源 URL 为空');
        setError('视频源 URL 为空');
        return;
      }
      
      const type = video.hls ? 'application/x-mpegURL' : 'video/mp4';
      const videoSrc = src.startsWith('http') ? src : SERVER_URL + src;
      
      console.log('[VideoPlayer] 设置视频源:', videoSrc);
      console.log('[VideoPlayer] 当前视频源:', player.currentSrc());
  console.log('[VideoPlayer] 是否为HLS流:', !!player.hls);
      player.src({ src: videoSrc, type });

      if (video.vttPath) {
        console.log('[VideoPlayer] 设置字幕源:', video.vttPath);
        const vttSrc = video.vttPath.startsWith('http') ? video.vttPath : SERVER_URL + video.vttPath;
        player.addRemoteTextTrack({
          kind: 'subtitles',
          src: vttSrc,
          srclang: 'zh',
          label: '中文',
          mode: 'showing'
        }, false);
      }

      // 初始化清晰度菜单
      const initQualityMenu = () => {

        if (player.qualityLevels) {
          const levels = player.qualityLevels();
          console.log('levels',levels);
          console.log('levels.levels_',levels.levels_);
          console.log('levels.levels_.length',levels.levels_.length);
          if (levels && levels.levels_ && levels.levels_.length > 1) {
            console.log('[VideoPlayer] 检测到多个清晰度级别:', levels.levels_.length);
            player.qualityMenu({ displayQuality: 'height' });
          } else if (video.hls) {
            // HLS流可能需要时间加载清晰度级别
            const checkLevels = () => {
              const currentLevels = player.qualityLevels();
              if (currentLevels && currentLevels.levels_ && currentLevels.levels_.length > 1) {
                console.log('[VideoPlayer] HLS清晰度级别加载完成:', currentLevels.levels_.length);
                player.qualityMenu({ displayQuality: 'height' });
              } else {
                setTimeout(checkLevels, 500);
              }
            };
            checkLevels();
          }
        } else {
          console.log('[VideoPlayer] qualityLevels 插件未加载');
        }
      };
      
      // 在视频可以播放后初始化清晰度菜单
      player.one('loadedmetadata', () => {
        initQualityMenu();
      });
      
      // 同时设置一个延迟检查
      setTimeout(initQualityMenu, 3000);
      
      return () => {
        player.off('canplay', handleCanPlay);
        player.off('error', handleError);
        player.off('loadedmetadata', handleMetadataInit);
        if (!player.isDisposed()) {
          player.dispose();
        }
      };
    } catch (err) {
      console.error('[VideoPlayer] 播放器初始化失败:', err);
      setError(`播放器初始化失败: ${err.message}`);
    }
  }, [isReady, onVideoReady, video, onChaptersGenerated]);

  // 监听跳转到指定时间的请求
  useEffect(() => {
    if (jumpToTime !== null && playerRef.current && !playerRef.current.isDisposed()) {
      const timeInSeconds = parseFloat(jumpToTime);
      if (!isNaN(timeInSeconds)) {
        console.log('[VideoPlayer] 跳转到时间:', timeInSeconds, '秒');
        playerRef.current.currentTime(timeInSeconds);
        playerRef.current.play();
      }
    }
  }, [jumpToTime]);

  if (error) {
    return (
      <div style={{ 
        width: '100%', 
        padding: '2rem', 
        background: '#1a1a2e', 
        color: '#ff6b6b',
        textAlign: 'center',
        borderRadius: '0.5rem'
      }}>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ 
      width: '100%', 
      position: 'relative', 
      aspectRatio: '16/9', 
      minHeight: '200px',
      background: '#0f1115'
    }}>
      <video
        ref={videoRef}
        className="video-js vjs-big-play-centered"
        playsInline
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* 视频未加载完成时显示预览图 */}
      {previewImage && !isVideoLoaded && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 10,
          borderRadius: '0.5rem',
          overflow: 'hidden'
        }}>
          <img 
            src={previewImage} 
            alt="视频预览"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}
      
      {isUploading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          borderRadius: '0.5rem'
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6ea8fe" strokeWidth="2" style={{ marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
          <div style={{ color: '#fff', fontSize: '1rem', marginBottom: '0.5rem' }}>
            {uploadProgress < 100 ? '正在上传...' : '正在准备视频...'}
          </div>
          <div style={{ width: '60%', maxWidth: '200px' }}>
            <div style={{
              height: '6px',
              background: '#2a2d36',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div 
                style={{
                  height: '100%',
                  width: `${uploadProgress}%`,
                  background: '#6ea8fe',
                  borderRadius: '3px',
                  transition: 'width 0.3s ease-out'
                }}
              />
            </div>
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {uploadProgress}%
          </div>
        </div>
      )}
    </div>
  );
}
