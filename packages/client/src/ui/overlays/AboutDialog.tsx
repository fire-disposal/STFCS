/**
 * AboutDialog - 软件信息弹窗
 */

import React from "react";
import { Dialog, Flex, Box, Text, Separator, Button } from "@radix-ui/themes";
import { Heart, Code, Palette, FileText } from "lucide-react";

interface AboutDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ open, onOpenChange }) => {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content style={{ maxWidth: 400 }}>
				<Dialog.Title>
					<Flex align="center" gap="2">
						<Heart size={16} />
						<Text>STFCS - 舰船战术舰队战斗系统</Text>
					</Flex>
				</Dialog.Title>

				<Flex direction="column" gap="3" mt="4">
					<Box>
						<Flex align="center" gap="2" mb="2">
							<Code size={14} />
							<Text size="2" weight="bold">程序开发</Text>
						</Flex>
						<Text size="1" color="gray">firedisposal</Text>
					</Box>

					<Separator size="2" />

					<Box>
						<Flex align="center" gap="2" mb="2">
							<Palette size={14} />
							<Text size="2" weight="bold">设计</Text>
						</Flex>
						<Text size="1" color="gray">UMP45</Text>
					</Box>

					<Separator size="2" />

					<Box>
						<Flex align="center" gap="2" mb="2">
							<FileText size={14} />
							<Text size="2" weight="bold">许可证</Text>
						</Flex>
						<Text size="1" color="gray">MIT License</Text>
					</Box>

					<Separator size="2" />

					<Box style={{ background: "rgba(74, 158, 255, 0.08)", padding: 12, borderRadius: 8 }}>
						<Text size="1" style={{ fontStyle: "italic", color: "#4a9eff" }}>
							致敬《远行星号》(Starsector)
						</Text>
						<Text size="1" color="gray" mt="2">
							本项目为同人二次创作作品
						</Text>
					</Box>

					<Box mt="3">
						<Text size="1" color="gray">
							Starship Tactical Fleet Combat System
						</Text>
						<Text size="1" color="gray">
							© 2024 firedisposal & UMP45
						</Text>
					</Box>
				</Flex>

				<Flex justify="end" mt="4">
					<Dialog.Close>
						<Button size="1" variant="soft">关闭</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};

export default AboutDialog;