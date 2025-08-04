import { useState } from 'react';

interface TestImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TestImportModal({ isOpen, onClose, onSuccess }: TestImportModalProps) {
  const [textContent, setTextContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!textContent.trim()) {
      setUploadStatus('请输入剧本内容');
      return;
    }

    setIsUploading(true);
    setUploadStatus('正在分析剧本内容...');

    try {
      const response = await fetch('/api/scripts/import-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ textContent }),
      });

      const result = await response.json();

      if (result.success) {
        setUploadStatus(`成功导入剧本：${result.script.title}`);
        setTimeout(() => {
          onSuccess();
          onClose();
          setTextContent('');
          setUploadStatus('');
        }, 2000);
      } else {
        setUploadStatus(`导入失败: ${result.error}`);
      }
    } catch (error) {
      console.error('导入失败:', error);
      setUploadStatus('导入失败，请稍后重试');
    } finally {
      setIsUploading(false);
    }
  };

  const loadTestContent = () => {
    setTextContent(`剧本杀测试剧本：《神秘的餐厅》

背景故事：
在一个雾雨朦胧的夜晚，著名的法式餐厅"银色玫瑰"正在举办一场私人聚会。这家餐厅以其精美的法式料理和优雅的环境而闻名，今晚邀请了几位特殊的客人共进晚餐。

然而，就在晚餐进行到一半时，灯光突然熄灭，当灯光重新亮起时，餐厅老板安德烈被发现倒在酒窖中，已经没有了生命迹象。现场一片混乱，每个人都成了嫌疑人。

角色设定：

1. 安妮（主厨）
- 30岁，在这家餐厅工作了5年
- 性格热情，对料理有着极致的追求
- 最近和老板因为菜单创新问题产生了分歧

2. 马克（侍酒师）
- 28岁，酒类专家，对各种红酒了如指掌
- 平时话不多，但观察力很强
- 发现老板最近频繁进出酒窖，行为有些异常

3. 苏菲（常客）
- 45岁，富有的艺术收藏家
- 是餐厅的VIP客户，经常在这里举办聚会
- 传言她和安德烈有着特殊的关系

剧情要求：
玩家需要通过在餐厅中寻找线索，与其他角色对话，最终找出真正的凶手。每个角色都有自己的秘密和动机，真相往往隐藏在细节之中。

重要线索：
- 酒窖中的一瓶红酒被打翻
- 安德烈的口袋里有一张神秘的纸条
- 厨房里的刀具少了一把
- 苏菲的手提包里有一些奇怪的药片

游戏目标：
找出凶手，揭开"银色玫瑰"餐厅的秘密。`);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">导入剧本（测试版）</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              剧本内容
            </label>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="w-full h-64 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="请输入或粘贴剧本内容..."
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadTestContent}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors"
            >
              加载测试内容
            </button>
          </div>

          {uploadStatus && (
            <div className={`p-3 rounded-md ${
              uploadStatus.includes('成功') 
                ? 'bg-green-800 text-green-100' 
                : uploadStatus.includes('失败') 
                  ? 'bg-red-800 text-red-100'
                  : 'bg-blue-800 text-blue-100'
            }`}>
              {uploadStatus}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              disabled={isUploading}
            >
              取消
            </button>
            <button
              onClick={handleImport}
              disabled={isUploading || !textContent.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? '正在导入...' : '导入剧本'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
