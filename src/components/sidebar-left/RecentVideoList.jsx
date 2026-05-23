import VideoListItem from './VideoListItem'

function RecentVideoList({ videos }) {
  return (
    <div className="video-list">
      <h3 className="list-title">最近上传</h3>
      <ul className="video-items">
        {videos.map((video, index) => (
          <VideoListItem key={index} video={video} />
        ))}
      </ul>
    </div>
  )
}

export default RecentVideoList
