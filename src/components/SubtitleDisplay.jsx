// 导入 React
import React from 'react'

/**
 * 字幕显示组件
 * - 实时高亮当前播放位置的字幕
 * - 点击字幕可跳转到对应时间
 */
function SubtitleDisplay({ subtitles, currentTime, onJumpToTime }) {
  // 找到当前播放位置对应的字幕索引
  const highlightedIndex = subtitles.findIndex(sub => 
    currentTime >= sub.startTime && currentTime <= sub.endTime
  );

  return (
    <div style={{
      backgroundColor: '#1a1d24',
      borderRadius: '12px',
      padding: '16px',
      maxHeight: '300px',
      overflowY: 'auto'
    }}>
      <h3 style={{ 
        color: '#f3f4f6', 
        fontSize: '16px', 
        marginBottom: '12px',
        fontWeight: '600'
      }}>📝 字幕</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {subtitles.map((subtitle, index) => (
          <div
            key={index}
            onClick={() => onJumpToTime(subtitle.startTime)}
            style={{
              backgroundColor: index === highlightedIndex ? '#ffd70040' : 'transparent',
              color: index === highlightedIndex ? '#ffd700' : '#9ca3af',
              padding: '8px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              borderLeft: index === highlightedIndex ? '3px solid #ffd700' : '3px solid transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff10';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = index === highlightedIndex ? '#ffd70040' : 'transparent';
            }}
          >
            <span style={{ 
              fontSize: '12px', 
              color: '#6b7280', 
              marginRight: '8px',
              fontFamily: 'monospace'
            }}>
              {formatTime(subtitle.startTime)} - {formatTime(subtitle.endTime)}
            </span>
            <span style={{ fontSize: '14px', lineHeight: '1.5' }}>
              {subtitle.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 格式化时间显示
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
}

export default SubtitleDisplay
