import React from 'react';

function VideoTimeline({ segments, onSegmentClick, currentTime }) {
  if (!segments || segments.length === 0) {
    return null;
  }

  return (
    <div className="video-timeline">
      <div className="timeline-header">
        <h3>视频分段</h3>
      </div>
      <div className="timeline-container">
        <div className="timeline-track">
          {segments.map((segment, index) => {
            const isActive = currentTime >= segment.startTime && currentTime < segment.endTime;
            return (
              <div
                key={index}
                className={`timeline-segment ${isActive ? 'active' : ''}`}
                style={{
                  left: `${(segment.startTime / segments[segments.length - 1].endTime) * 100}%`,
                  width: `${((segment.endTime - segment.startTime) / segments[segments.length - 1].endTime) * 100}%`
                }}
                onClick={() => onSegmentClick(segment)}
                title={`${segment.title}\n${segment.description}`}
              />
            );
          })}
        </div>
        <div className="timeline-segments-list">
          {segments.map((segment, index) => {
            const isActive = currentTime >= segment.startTime && currentTime < segment.endTime;
            return (
              <div
                key={index}
                className={`segment-item ${isActive ? 'active' : ''}`}
                onClick={() => onSegmentClick(segment)}
              >
                <div className="segment-time">
                  {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                </div>
                <div className="segment-title">{segment.title}</div>
                <div className="segment-description">{segment.description}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default VideoTimeline;