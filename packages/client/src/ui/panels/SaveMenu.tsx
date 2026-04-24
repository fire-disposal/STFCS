/**
 * SaveMenu - 存档菜单组件
 */

import React, { useState, useCallback, useEffect } from "react";
import { Save, Trash2, Download, Loader2, Plus } from "lucide-react";
import { Dialog, Flex, Box, Text, Button, IconButton, TextField, Badge } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import { notify } from "@/ui/shared/Notification";
import type { SaveBuild } from "@vt/data";
import "./save-menu.css";

interface SaveMenuProps {
	isHost: boolean;
	inRoom: boolean;
}

export const SaveMenu: React.FC<SaveMenuProps> = ({ isHost, inRoom }) => {
	const [open, setOpen] = useState(false);
	const [saves, setSaves] = useState<SaveBuild[]>([]);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [newSaveName, setNewSaveName] = useState("");
	const [showCreate, setShowCreate] = useState(false);

	const { send } = useGameAction();

	const loadSaves = useCallback(async () => {
		setLoading(true);
		try {
			const result = await send("save:action", { action: "list" }) as { saves?: SaveBuild[] } | null;
			if (result?.saves) {
				setSaves(result.saves);
			}
		} catch (error) {
			notify.error("加载存档列表失败");
		}
		setLoading(false);
	}, [send]);

	useEffect(() => {
		if (open) {
			loadSaves();
		}
	}, [open, loadSaves]);

	const handleCreate = useCallback(async () => {
		if (!newSaveName.trim()) {
			notify.error("请输入存档名称");
			return;
		}

		setSaving(true);
		try {
			await send("save:action", { action: "create", name: newSaveName.trim() });
			notify.success("存档已创建");
			setNewSaveName("");
			setShowCreate(false);
			loadSaves();
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "创建失败");
		}
		setSaving(false);
	}, [newSaveName, send, loadSaves]);

	const handleLoad = useCallback(async (saveId: string) => {
		if (!inRoom || !isHost) {
			notify.error("只有房主在房间内可加载存档");
			return;
		}

		setSaving(true);
		try {
			await send("save:action", { action: "load", saveId });
			notify.success("存档已加载");
			setOpen(false);
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "加载失败");
		}
		setSaving(false);
	}, [inRoom, isHost, send]);

	const handleDelete = useCallback(async (saveId: string, name: string) => {
		if (!window.confirm(`确定删除存档 "${name}"？`)) return;

		setSaving(true);
		try {
			await send("save:action", { action: "delete", saveId });
			notify.success("存档已删除");
			loadSaves();
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "删除失败");
		}
		setSaving(false);
	}, [send, loadSaves]);

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleString("zh-CN", {
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger>
				<button className="top-bar__action-btn" title="存档">
					<Save size={16} />
					存档
				</button>
			</Dialog.Trigger>

			<Dialog.Content className="save-menu-dialog" style={{ maxWidth: 480 }}>
				<Dialog.Title>
					<Flex align="center" gap="2">
						<Save size={16} />
						<Text>存档管理</Text>
					</Flex>
				</Dialog.Title>

				<Box className="save-menu-content">
					<Flex justify="between" align="center" mb="3">
						<Text size="1" color="gray">
							共 {saves.length} 个存档
						</Text>
						<Button size="1" variant="soft" onClick={() => setShowCreate(!showCreate)}>
							<Plus size={12} />
							新建存档
						</Button>
					</Flex>

					{showCreate && (
						<Flex className="save-create-form" gap="2" mb="3">
							<TextField.Root
								size="1"
								placeholder="存档名称"
								value={newSaveName}
								onChange={(e) => setNewSaveName(e.target.value)}
								style={{ flex: 1 }}
							/>
							<Button size="1" variant="solid" onClick={handleCreate} disabled={saving}>
								{saving ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
								保存
							</Button>
						</Flex>
					)}

					{loading ? (
						<Flex justify="center" align="center" py="4">
							<Loader2 size={16} className="spin" />
						</Flex>
					) : saves.length === 0 ? (
						<Flex justify="center" align="center" py="4">
							<Text size="1" color="gray">暂无存档</Text>
						</Flex>
					) : (
						<Box className="save-list">
							{saves.map((save) => (
								<Flex
									key={save.$id}
									className="save-item"
									align="center"
									gap="3"
									justify="between"
								>
									<Box className="save-item-info">
										<Text size="1" weight="bold">{save.metadata.name}</Text>
										<Flex gap="2" align="center">
											<Text size="1" color="gray">
												{formatDate(save.createdAt)}
											</Text>
											<Badge size="1" color="gray">
												{Object.keys(save.snapshot.tokens).length} 舰船
											</Badge>
										</Flex>
									</Box>

									<Flex gap="1">
										<IconButton
											size="1"
											variant="soft"
											color="blue"
											onClick={() => handleLoad(save.$id)}
											disabled={!inRoom || !isHost || saving}
											title={isHost ? "加载到当前房间" : "仅房主可加载"}
										>
											<Download size={12} />
										</IconButton>
										<IconButton
											size="1"
											variant="soft"
											color="red"
											onClick={() => handleDelete(save.$id, save.metadata.name)}
											disabled={saving}
											title="删除"
										>
											<Trash2 size={12} />
										</IconButton>
									</Flex>
								</Flex>
							))}
						</Box>
					)}
				</Box>

				<Dialog.Close>
					<Button variant="soft" size="1">
						关闭
					</Button>
				</Dialog.Close>
			</Dialog.Content>
		</Dialog.Root>
	);
};

export default SaveMenu;