function VideoListItem({ video }) {
  return (
    <li className="video-item">
      <div className="video-thumbnail">
        <svg className="play-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polygon points="5.5,3.5 19,12 5.5,20.5" />
        </svg>
      </div>
      <div className="video-info">
        <span className="video-name">{video.name}</span>
        <span className="video-date">{video.date}</span>
      </div>
    </li>
  )
}

export default VideoListItem
