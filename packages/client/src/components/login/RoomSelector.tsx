/**
 * 房间选择组件
 *
 * 支持三种模式：
 * 1. 快速加入 - 自动加入默认房间或人数最多的房间
 * 2. 选择房间 - 从已有房间列表中选择
 * 3. 创建房间 - 创建新的私人房间
 *
 * 新功能：
 * - 私密房间支持（密码）
 * - 房主显示
 * - 房间阶段显示
 */

import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Crown, Users, Play, Pause, Circle, Zap, Home, Plus } from "lucide-react";

export interface RoomInfo {
	roomId: string;
	name: string;
	playerCount: number;
	maxPlayers: number;
	createdAt: number;
	isPrivate: boolean;
	phase: 'lobby' | 'deployment' | 'playing' | 'paused' | 'ended';
	ownerId: string | null;
}

interface RoomSelectorProps {
	selectedRoomId: string | null;
	onRoomSelect: (roomId: string) => void;
	onRoomCreate: (options: RoomCreateOptions) => Promise<void>;
	disabled?: boolean;
	rooms?: RoomInfo[];
}

export interface RoomCreateOptions {
	roomId: string;
	name?: string;
	maxPlayers: number;
	isPrivate: boolean;
}

type SelectionMode = "quick" | "select" | "create";

export const RoomSelector: React.FC<RoomSelectorProps> = ({
	selectedRoomId,
	onRoomSelect,
	onRoomCreate,
	disabled = false,
	rooms: externalRooms,
}) => {
	const { t } = useTranslation();
	const [mode, setMode] = useState<SelectionMode>("quick");
	const [rooms, setRooms] = useState<RoomInfo[]>(externalRooms || []);
	const [isLoading, setIsLoading] = useState(false);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [newRoomId, setNewRoomId] = useState("");
	const [newRoomName, setNewRoomName] = useState("");
	const [newRoomMaxPlayers, setNewRoomMaxPlayers] = useState(8);
	const [newRoomIsPrivate, setNewRoomIsPrivate] = useState(false);
	const [error, setError] = useState("");

	// 使用外部传入的房间列表
	useEffect(() => {
		if (externalRooms) {
			setRooms(externalRooms);
		}
	}, [externalRooms]);

	// 处理房间选择
	const handleRoomSelect = useCallback((room: RoomInfo) => {
		onRoomSelect(room.roomId);
	}, [onRoomSelect]);

	// 处理创建房间
	const handleCreateRoom = useCallback(async () => {
		if (!newRoomId.trim()) {
			setError(t('room.error.idRequired'));
			return;
		}

		setIsLoading(true);
		setError("");

		try {
			await onRoomCreate({
				roomId: newRoomId.trim(),
				name: newRoomName.trim() || undefined,
				maxPlayers: newRoomMaxPlayers,
				isPrivate: newRoomIsPrivate,
			});

			// 重置表单
			setNewRoomId("");
			setNewRoomName("");
			setNewRoomMaxPlayers(8);
			setNewRoomIsPrivate(false);
			setShowCreateForm(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to create room');
		} finally {
			setIsLoading(false);
		}
	}, [newRoomId, newRoomName, newRoomMaxPlayers, newRoomIsPrivate, onRoomCreate, t]);

	// 获取阶段图标
	const getPhaseIcon = useCallback((phase: string) => {
		switch (phase) {
			case 'lobby':
				return <Home size={12} />;
			case 'deployment':
				return <Plus size={12} />;
			case 'playing':
				return <Play size={12} />;
			case 'paused':
				return <Pause size={12} />;
			case 'ended':
				return <Circle size={12} />;
			default:
				return <Circle size={12} />;
		}
	}, []);

	// 获取阶段颜色
	const getPhaseColor = useCallback((phase: string) => {
		switch (phase) {
			case 'lobby':
				return 'var(--color-info)';
			case 'deployment':
				return 'var(--color-warning)';
			case 'playing':
				return 'var(--color-success)';
			case 'paused':
				return 'var(--color-text-secondary)';
			case 'ended':
				return 'var(--color-error)';
			default:
				return 'var(--color-text-secondary)';
		}
	}, []);

	// 渲染房间列表
	const renderRoomList = () => (
		<div className="room-list">
			{rooms.length === 0 ? (
				<div className="no-rooms">
					<p>{t('room.noRooms')}</p>
				</div>
			) : (
				rooms.map((room) => (
					<div
						key={room.roomId}
						className={`room-item ${selectedRoomId === room.roomId ? 'selected' : ''}`}
						onClick={() => handleRoomSelect(room)}
					>
						<div className="room-info">
							<div className="room-name">
								{room.isPrivate && <Lock size={12} />}
								<span>{room.name || room.roomId}</span>
							</div>
							<div className="room-meta">
								<span className="room-phase" style={{ color: getPhaseColor(room.phase) }}>
									{getPhaseIcon(room.phase)}
									{t(`phase.${room.phase}`)}
								</span>
								<span className="room-players">
									<Users size={12} />
									{room.playerCount}/{room.maxPlayers}
								</span>
							</div>
						</div>
						{room.ownerId && (
							<div className="room-owner">
								<Crown size={12} />
							</div>
						)}
					</div>
				))
			)}
		</div>
	);

	// 渲染创建房间表单
	const renderCreateForm = () => (
		<div className="create-room-form">
			<div className="form-group">
				<label>{t('room.roomId')}</label>
				<input
					type="text"
					value={newRoomId}
					onChange={(e) => setNewRoomId(e.target.value)}
					placeholder={t('room.placeholder.roomId')}
					disabled={disabled || isLoading}
				/>
			</div>

			<div className="form-group">
				<label>{t('room.roomName')}</label>
				<input
					type="text"
					value={newRoomName}
					onChange={(e) => setNewRoomName(e.target.value)}
					placeholder={t('room.placeholder.roomName')}
					disabled={disabled || isLoading}
				/>
			</div>

			<div className="form-group">
				<label>{t('room.maxPlayers')}</label>
				<input
					type="number"
					value={newRoomMaxPlayers}
					onChange={(e) => setNewRoomMaxPlayers(parseInt(e.target.value) || 8)}
					min={2}
					max={8}
					disabled={disabled || isLoading}
				/>
			</div>

			<div className="form-group checkbox">
				<label>
					<input
						type="checkbox"
						checked={newRoomIsPrivate}
						onChange={(e) => setNewRoomIsPrivate(e.target.checked)}
						disabled={disabled || isLoading}
					/>
					{t('room.privateRoom')}
				</label>
			</div>

			{newRoomIsPrivate && (
				<div className="form-group">
					<p>{t('room.privateRoom')}</p>
				</div>
			)}

			{error && <div className="form-error">{error}</div>}

			<div className="form-actions">
				<button
					className="btn-secondary"
					onClick={() => setShowCreateForm(false)}
					disabled={isLoading}
				>
					{t('common.cancel')}
				</button>
				<button
					className="btn-primary"
					onClick={handleCreateRoom}
					disabled={isLoading || !newRoomId.trim()}
				>
					{isLoading ? t('common.creating') : t('room.create')}
				</button>
			</div>
		</div>
	);

	return (
		<div className="room-selector">
			{/* 模式切换 */}
			<div className="mode-tabs">
				<button
					className={`mode-tab ${mode === 'quick' ? 'active' : ''}`}
					onClick={() => setMode('quick')}
					disabled={disabled}
				>
					<Zap size={14} />
					{t('room.quickJoin')}
				</button>
				<button
					className={`mode-tab ${mode === 'select' ? 'active' : ''}`}
					onClick={() => setMode('select')}
					disabled={disabled}
				>
					<Home size={14} />
					{t('room.selectRoom')}
				</button>
				<button
					className={`mode-tab ${mode === 'create' ? 'active' : ''}`}
					onClick={() => setMode('create')}
					disabled={disabled}
				>
					<Plus size={14} />
					{t('room.createRoom')}
				</button>
			</div>

			{/* 内容区域 */}
			<div className="room-content">
				{mode === 'quick' && (
					<div className="quick-join">
						<p>{t('room.quickJoinDescription')}</p>
						<button
							className="btn-primary btn-large"
							onClick={() => onRoomSelect('default')}
							disabled={disabled || isLoading}
						>
							<Zap size={16} />
							{t('room.joinDefaultRoom')}
						</button>
					</div>
				)}

				{mode === 'select' && renderRoomList()}

				{mode === 'create' && (showCreateForm ? renderCreateForm() : (
					<div className="create-options">
						<button
							className="btn-primary"
							onClick={() => setShowCreateForm(true)}
							disabled={disabled}
						>
							<Plus size={14} />
							{t('room.createNewRoom')}
						</button>
					</div>
				))}
			</div>

			{/* 样式 */}
			<style>{`
				.room-selector {
					display: flex;
					flex-direction: column;
					gap: 12px;
				}

				.mode-tabs {
					display: flex;
					gap: 8px;
				}

				.mode-tab {
					flex: 1;
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 6px;
					padding: 10px;
					background: var(--color-surface);
					border: 1px solid var(--color-border);
					border-radius: 6px;
					color: var(--color-text-secondary);
					cursor: pointer;
					transition: all 0.2s;
				}

				.mode-tab:hover {
					background: var(--color-surface-dark);
				}

				.mode-tab.active {
					background: var(--color-primary);
					border-color: var(--color-primary);
					color: white;
				}

				.room-content {
					min-height: 200px;
				}

				.quick-join {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 16px;
					padding: 24px;
					text-align: center;
				}

				.room-list {
					display: flex;
					flex-direction: column;
					gap: 8px;
					max-height: 300px;
					overflow-y: auto;
				}

				.room-item {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 12px;
					background: var(--color-surface);
					border: 1px solid var(--color-border);
					border-radius: 6px;
					cursor: pointer;
					transition: all 0.2s;
				}

				.room-item:hover {
					background: var(--color-surface-dark);
				}

				.room-item.selected {
					border-color: var(--color-primary);
					background: rgba(var(--color-primary-rgb), 0.1);
				}

				.room-info {
					display: flex;
					flex-direction: column;
					gap: 4px;
				}

				.room-name {
					display: flex;
					align-items: center;
					gap: 6px;
					font-weight: 500;
				}

				.room-meta {
					display: flex;
					align-items: center;
					gap: 12px;
					font-size: 12px;
				}

				.room-phase, .room-players {
					display: flex;
					align-items: center;
					gap: 4px;
				}

				.room-owner {
					color: var(--color-warning);
				}

				.no-rooms {
					padding: 24px;
					text-align: center;
					color: var(--color-text-secondary);
				}

				.create-room-form {
					display: flex;
					flex-direction: column;
					gap: 12px;
				}

				.form-group {
					display: flex;
					flex-direction: column;
					gap: 4px;
				}

				.form-group label {
					font-size: 12px;
					color: var(--color-text-secondary);
				}

				.form-group input {
					padding: 8px 12px;
					background: var(--color-background);
					border: 1px solid var(--color-border);
					border-radius: 4px;
					color: var(--color-text);
				}

				.form-group.checkbox {
					flex-direction: row;
					align-items: center;
				}

				.form-error {
					padding: 8px;
					background: rgba(var(--color-error-rgb), 0.1);
					border: 1px solid var(--color-error);
					border-radius: 4px;
					color: var(--color-error);
					font-size: 12px;
				}

				.form-actions {
					display: flex;
					gap: 8px;
					justify-content: flex-end;
				}

				.modal-actions {
					display: flex;
					gap: 8px;
					justify-content: flex-end;
				}

				.btn-primary {
					padding: 8px 16px;
					background: var(--color-primary);
					border: none;
					border-radius: 4px;
					color: white;
					cursor: pointer;
				}

				.btn-primary:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}

				.btn-secondary {
					padding: 8px 16px;
					background: var(--color-surface);
					border: 1px solid var(--color-border);
					border-radius: 4px;
					color: var(--color-text);
					cursor: pointer;
				}

				.btn-large {
					padding: 12px 24px;
					font-size: 16px;
				}
			`}</style>
		</div>
	);
};