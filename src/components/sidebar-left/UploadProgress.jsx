function UploadProgress({ progress }) {
  return (
    <div className="upload-progress">
      <div className="progress-bar" style={{ width: `${progress}%` }}></div>
      <span className="progress-text">{progress}%</span>
    </div>
  )
}

export default UploadProgress
