'use client';

interface Friend {
  id: string;
  username: string;
  isOnline: boolean;
}

interface FriendsListProps {
  friends: Friend[];
}

export default function FriendsList({ friends }: FriendsListProps) {
  if (friends.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="text-3xl mb-2">�</div>
        <p className="text-gray-400 text-sm">暂无好友</p>
        <p className="text-gray-500 text-xs mt-1">添加好友一起游戏</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {friends.map((friend) => (
        <div key={friend.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
          <div className="flex items-center space-x-3">
            <div className={`w-2 h-2 rounded-full ${
              friend.isOnline ? 'bg-green-500' : 'bg-gray-500'
            }`}></div>
            <div>
              <h4 className="text-white text-sm font-medium">{friend.username}</h4>
              <p className="text-xs text-gray-400">
                {friend.isOnline ? '在线' : '离线'}
              </p>
            </div>
          </div>
          
          <div className="flex space-x-1">
            <button className="btn-secondary px-2 py-1 text-xs">
              聊天
            </button>
            {friend.isOnline && (
              <button className="btn-primary px-2 py-1 text-xs">
                邀请
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
