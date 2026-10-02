import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { useSettings } from "@/lib/store";

/** AI key, stored in this browser only. */
export function AiKeyButton() {
  const [settings, updateSettings] = useSettings();
  const [key, setKey] = useState<string>();
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="AI key" />}
        className={settings.aiKey ? undefined : "text-destructive"}
      >
        <KeyRoundIcon />
      </PopoverTrigger>
      <PopoverContent align="end" className="gap-2">
        <p className="text-sm font-medium">AI key</p>
        <p className="text-xs text-muted-foreground">Stored in this browser, sent only to the AI provider.</p>
        <form
          className="flex items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void updateSettings({ aiKey: (key ?? settings.aiKey).trim() });
          }}
        >
          {/* Textarea: some APIs need several values (NAME=value, one per line). Masked like a password. */}
          <Textarea
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-…"
            value={key ?? settings.aiKey}
            onChange={(e) => setKey(e.target.value)}
            style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
            className="min-h-9 rounded-xl font-mono text-xs"
          />
          <Button type="submit" size="sm">Save</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
