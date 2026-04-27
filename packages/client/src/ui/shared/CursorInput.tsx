/**
 * CursorInput - 游标坐标输入组件
 *
 * 显示/编辑游标 X-Y-R 坐标（位置 X、位置 Y、朝向 R）
 * 支持粘贴解析、合法性验证、状态反馈
 *
 * 状态：
 * - IDLE: 空闲状态，显示当前坐标 + 复制按钮
 * - EDITING: 编辑状态，用户正在输入
 * - VALID: 内容合法，可跳转
 * - INVALID: 内容非法，不可跳转
 */

import { Check, Copy, Move, X } from "lucide-react";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { normalizeAngle } from "@vt/data";

export type CursorState = "IDLE" | "EDITING" | "VALID" | "INVALID";

export interface CursorInputProps {
    cursorX: number;
    cursorY: number;
    cursorR: number;
    onCursorChange: (x: number, y: number, r: number) => void;
    worldBounds?: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    };
}

// 游标坐标格式正则：X,Y,R
const CURSOR_REGEX =
    /^\s*\(?\s*(-?\d+(?:\.\d+)?)\s*[,]\s*(-?\d+(?:\.\d+)?)\s*(?:[,]\s*(-?\d+(?:\.\d+)?)\s*)?\)?\s*$/;

const DEFAULT_BOUNDS = {
    minX: -10000,
    maxX: 10000,
    minY: -10000,
    maxY: 10000,
};

export const CursorInput: React.FC<CursorInputProps> = ({
    cursorX,
    cursorY,
    cursorR,
    onCursorChange,
    worldBounds = DEFAULT_BOUNDS,
}) => {
    const [state, setState] = useState<CursorState>("IDLE");
    const [inputValue, setInputValue] = useState<string>("");
    const [parsedCoords, setParsedCoords] = useState<{
        x: number;
        y: number;
        r: number;
    } | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const isExternalChange = useRef(false);
    const lastDisplayValueRef = useRef<string>("");

    // 格式化当前游标坐标（显示航海角度格式）
    const formatCurrentCoords = useCallback(() => {
        // 游标存储的是 PixiJS 角度（负值表示顺时针），显示时转换为航海角度（正值）
        const displayR = normalizeAngle(-cursorR);
        return `${Math.round(cursorX)},${Math.round(cursorY)},${Math.round(displayR)}`;
    }, [cursorX, cursorY, cursorR]);

    // 解析游标坐标字符串
    const parseCoordinates = useCallback(
        (text: string): { x: number; y: number; r: number } | null => {
            const match = text.match(CURSOR_REGEX);
            if (!match) return null;

            const x = parseFloat(match[1]);
            const y = parseFloat(match[2]);
            const r = match[3] !== undefined ? parseFloat(match[3]) : cursorR;

            if (isNaN(x) || isNaN(y) || isNaN(r)) return null;

            if (x < worldBounds.minX || x > worldBounds.maxX) return null;
            if (y < worldBounds.minY || y > worldBounds.maxY) return null;
            if (r < -360 || r > 360) return null;

            return { x, y, r };
        },
        [worldBounds, cursorR]
    );

    // 处理输入变化
    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            setInputValue(value);

            if (value.trim() === "") {
                setState("EDITING");
                setParsedCoords(null);
                return;
            }

            const parsed = parseCoordinates(value);
            if (parsed) {
                setState("VALID");
                setParsedCoords(parsed);
            } else {
                setState("INVALID");
                setParsedCoords(null);
            }
        },
        [parseCoordinates]
    );

    // 处理聚焦
    const handleFocus = useCallback(() => {
        setState("EDITING");
        if (inputRef.current) {
            inputRef.current.select();
        }
    }, []);

    // 处理失焦
    const handleBlur = useCallback(() => {
        if (state === "EDITING" && !parsedCoords) {
            setInputValue(formatCurrentCoords());
            setState("IDLE");
        }
    }, [state, parsedCoords, formatCurrentCoords]);

    // 处理跳转
    const handleJump = useCallback(() => {
        if (state !== "VALID" || !parsedCoords) return;

        isExternalChange.current = true;

        // 用户输入航海角度，转换为 PixiJS 角度存储（负值）
        const pixiR = -normalizeAngle(parsedCoords.r);
        const currentPixiR = cursorR;

        if (
            parsedCoords.x !== Math.round(cursorX) ||
            parsedCoords.y !== Math.round(cursorY) ||
            pixiR !== currentPixiR
        ) {
            onCursorChange(parsedCoords.x, parsedCoords.y, pixiR);
        }

        setState("IDLE");
        setInputValue(formatCurrentCoords());
    }, [state, parsedCoords, cursorX, cursorY, cursorR, onCursorChange, formatCurrentCoords]);

    // 处理复制
    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(formatCurrentCoords());
        } catch (err) {
            console.error("复制失败:", err);
        }
    }, [formatCurrentCoords]);

    // 清空输入
    const handleClear = useCallback(() => {
        setInputValue("");
        setParsedCoords(null);
        setState("EDITING");
        inputRef.current?.focus();
    }, []);

    // 监听外部游标变化
    useEffect(() => {
        if (isExternalChange.current) {
            isExternalChange.current = false;
            return;
        }

        if (state !== "IDLE") return;

        const newValue = formatCurrentCoords();
        if (newValue !== lastDisplayValueRef.current) {
            lastDisplayValueRef.current = newValue;
            setInputValue(newValue);
        }
    }, [state, cursorX, cursorY, cursorR, formatCurrentCoords]);

    // 初始化
    useEffect(() => {
        setInputValue(formatCurrentCoords());
    }, []);

    // 获取状态对应的样式类
    const getStateClass = () => {
        switch (state) {
            case "VALID":
                return "cursor-coordinate-input--valid";
            case "INVALID":
                return "cursor-coordinate-input--invalid";
            case "EDITING":
                return "cursor-coordinate-input--editing";
            default:
                return "cursor-coordinate-input--idle";
        }
    };

    // 获取按钮配置
    const getButtonConfig = () => {
        if (state === "VALID") {
            return {
                text: "跳转",
                icon: Move,
                onClick: handleJump,
                disabled: false,
                className: "cursor-coordinate-input__btn cursor-coordinate-input__btn--jump",
            };
        } else if (state === "INVALID") {
            return {
                text: "无效",
                icon: X,
                onClick: () => { },
                disabled: true,
                className: "cursor-coordinate-input__btn cursor-coordinate-input__btn--invalid",
            };
        } else {
            return {
                text: "复制",
                icon: Copy,
                onClick: handleCopy,
                disabled: false,
                className: "cursor-coordinate-input__btn cursor-coordinate-input__btn--copy",
            };
        }
    };

    const buttonConfig = getButtonConfig();
    const ButtonIcon = buttonConfig.icon;

    return (
        <div className={`cursor-coordinate-input ${getStateClass()}`}>
            <div className="cursor-coordinate-input__row">
                <div className="cursor-coordinate-input__wrapper">
                    <input
                        ref={inputRef}
                        type="text"
                        className="cursor-coordinate-input__field"
                        value={inputValue}
                        onChange={handleInputChange}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        placeholder="X,Y,R"
                        title="格式：X,Y,R（R=朝向角度）"
                    />
                    {state !== "IDLE" && inputValue && (
                        <button
                            className="cursor-coordinate-input__clear"
                            onClick={handleClear}
                            title="清空"
                        >
                            <X className="cursor-coordinate-input__clear-icon" />
                        </button>
                    )}
                </div>

                <button
                    data-magnetic
                    className={buttonConfig.className}
                    onClick={buttonConfig.onClick}
                    disabled={buttonConfig.disabled}
                    title={state === "VALID" ? "跳转到输入坐标" : "复制当前坐标"}
                >
                    <ButtonIcon className="cursor-coordinate-input__btn-icon" />
                    <span className="cursor-coordinate-input__btn-text">
                        {buttonConfig.text}
                    </span>
                </button>
            </div>

            {state !== "IDLE" && (
                <div className="cursor-coordinate-input__status">
                    {state === "VALID" && parsedCoords && (
                        <span className="cursor-coordinate-input__status-text">
                            <Check className="cursor-coordinate-input__status-icon" />
                            跳转至 ({Math.round(parsedCoords.x)},{Math.round(parsedCoords.y)},{Math.round(parsedCoords.r)}°)
                        </span>
                    )}
                    {state === "INVALID" && (
                        <span className="cursor-coordinate-input__status-text cursor-coordinate-input__status-text--error">
                            <X className="cursor-coordinate-input__status-icon" />
                            坐标格式错误或超出边界
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default CursorInput;
