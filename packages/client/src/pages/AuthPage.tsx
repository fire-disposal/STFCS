/**
 * 认证面板组件 - 简化版
 *
 * 只需输入用户名即可进入大厅
 * 使用 CSS 类名而非内联样式
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Badge, Box, Button, Card, Flex, Heading, Separator, Text, TextField } from '@radix-ui/themes';
import { LockKeyhole, User } from 'lucide-react';
import { BASE_PATH } from '@/config';

interface AuthPageProps {
  connected: boolean;
  onAuthenticated: (username: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  connected,
  onAuthenticated,
}) => {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';

  useEffect(() => {
    const saved = localStorage.getItem('stfcs_username');
    if (saved) setUsername(saved);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setError('请输入指挥官代号');
      return;
    }
    if (!connected) {
      setError('尚未连接到指挥服务器');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      localStorage.setItem('stfcs_username', trimmed);
      await onAuthenticated(trimmed);
    } catch (e) {
      console.error('[AuthPanel] Error:', e);
      setError(e instanceof Error ? e.message : '连接失败');
    } finally {
      setIsLoading(false);
    }
  }, [username, onAuthenticated, connected]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSubmit();
    }
  }, [handleSubmit, isLoading]);

  const isValid = username.trim().length > 0;

  return (
    <div className="radix-auth-shell">
      <div className="radix-grid-bg" />
      <Card className="radix-surface-card" size="4">
        <Flex gap="6" direction={{ initial: 'column', md: 'row' }}>
          <Flex direction="column" justify="between" className="radix-auth-side">
            <Box>
              <Flex align="center" gap="2" mb="2">
                <Text className="radix-auth-logo">◈</Text>
                <Heading size="8" mb="0">STFCS</Heading>
              </Flex>
              <Text color="gray" size="3">战术指挥系统</Text>
              <Separator my="4" size="4" />
              <Flex direction="column" gap="2">
                <Flex justify="between" align="center">
                  <Text size="2" color="gray">系统状态</Text>
                  <Badge color={connected ? 'green' : 'amber'} variant="soft">
                    {connected ? '在线' : '连接中'}
                  </Badge>
                </Flex>
                <Flex justify="between" align="center">
                  <Text size="2" color="gray">入口路径</Text>
                  <Badge variant="soft">{BASE_PATH}</Badge>
                </Flex>
                <Flex justify="between" align="center">
                  <Text size="2" color="gray">传输协议</Text>
                  <Badge color={secure ? 'green' : 'gray'} variant="soft">
                    {secure ? 'HTTPS' : 'HTTP'}
                  </Badge>
                </Flex>
              </Flex>
            </Box>
            <Text size="1" color="gray">STFCS v2.0 · 2026</Text>
          </Flex>

          <Flex direction="column" gap="4" className="radix-auth-form-wrap">
            <Heading size="5">登录指挥终端</Heading>
            {error && <Text className="radix-inline-error">{error}</Text>}
            <Box>
              <Text as="label" size="2" color="gray" mb="2" className="radix-label">指挥官代号</Text>
              <TextField.Root
                size="3"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入用户名"
                maxLength={32}
                disabled={isLoading}
                autoFocus
              >
                <TextField.Slot>
                  <User size={14} />
                </TextField.Slot>
              </TextField.Root>
            </Box>
            <Button
              size="3"
              onClick={handleSubmit}
              disabled={isLoading || !isValid || !connected}
              data-magnetic
            >
              <LockKeyhole size={16} />
              {isLoading ? '连接中...' : '进入系统'}
            </Button>
            {isLoading && <Text size="1" color="gray">正在连接服务器...</Text>}
          </Flex>
        </Flex>
      </Card>
    </div>
  );
};

export default AuthPage;