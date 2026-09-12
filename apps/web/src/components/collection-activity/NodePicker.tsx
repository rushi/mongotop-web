import type { TopNode } from "@mongotop-web/types";
import { memo } from "react";
import { getNodeRole } from "../../lib/formatActivity";
import { cn } from "../../lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface NodePickerProps {
    isSecondary: boolean;
    nodes: TopNode[];
    value: string | undefined;
    onChange: (host: string) => void;
}

// Memoized so the streaming table's per-tick re-renders don't re-render the open
// Select: re-rendering an open Radix popover makes it flicker and reflow.
const NodePickerComponent = ({ isSecondary, nodes, value, onChange }: NodePickerProps) => {
    const selectedRole = getNodeRole(nodes, value);

    return (
        <Select value={value ?? ""} disabled={nodes.length === 0} onValueChange={onChange}>
            <SelectTrigger
                className={cn(
                    "h-8 w-64 border-2 border-border bg-input font-mono text-xs",
                    isSecondary && "border-secondary-read text-secondary-read",
                )}
            >
                <SelectValue placeholder="Select a node">
                    {value ? `${selectedRole.toUpperCase()} · ${value}` : "—"}
                </SelectValue>
            </SelectTrigger>
            <SelectContent className="border-2 border-border">
                {nodes.map((node) => (
                    <SelectItem key={node.host} value={node.host} className="font-mono text-xs whitespace-nowrap">
                        {node.role.toUpperCase()} · {node.host}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

export const NodePicker = memo(NodePickerComponent);
