import { FolderOpenIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { allTables } from "@/agents";
import { Database } from "@/lib/crud-table";
import { getSavedFolder, hasAccess, pickFolder, requestAccess } from "@/lib/folder";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type State =
  | { status: "loading" }
  | { status: "pick"; error?: string }
  | { status: "reconnect"; handle: FileSystemDirectoryHandle; error?: string }
  | { status: "ready"; db: Database };

/** Opens the saved folder (or asks for one), creating missing table files. */
export function FolderGate({ children }: { children: (db: Database) => React.ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  const open = async (handle: FileSystemDirectoryHandle) => {
    setState({ status: "loading" });
    const db = new Database(handle, allTables);
    await db.load();
    setState({ status: "ready", db });
  };

  const attempt = (action: () => Promise<void>) =>
    action().catch((error) => {
      if (error?.name === "AbortError") return; // picker dismissed
      setState((s) => ({ ...(s.status === "reconnect" ? s : { status: "pick" }), error: errorMessage(error) }));
    });

  useEffect(() => {
    void attempt(async () => {
      const handle = await getSavedFolder();
      if (!handle) setState({ status: "pick" });
      else if (await hasAccess(handle)) await open(handle);
      else setState({ status: "reconnect", handle });
    });
  }, []);

  if (state.status === "ready") return children(state.db);
  if (state.status === "loading")
    return (
      <div className="grid h-dvh place-items-center">
        <Spinner className="text-muted-foreground" />
      </div>
    );

  const supported = typeof window !== "undefined" && "showDirectoryPicker" in window;
  return (
    <div className="grid h-dvh place-items-center bg-muted/40 p-6">
      <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border bg-background p-8 text-center shadow-[0_8px_30px_rgb(0_0_0/0.06)]">
        <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <FolderOpenIcon className="size-6" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">
          {state.status === "reconnect" ? `Reconnect “${state.handle.name}”` : "Choose a workspace folder"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Each table is stored as an Excel file in this folder. Missing files are created automatically.
        </p>
        {supported ? (
          <div className="mt-6 flex w-full flex-col gap-2">
            {state.status === "reconnect" && (
              <Button
                onClick={() =>
                  attempt(async () => {
                    if (!(await requestAccess(state.handle))) throw new Error("Write access was denied");
                    await open(state.handle);
                  })
                }
              >
                Allow access
              </Button>
            )}
            <Button
              variant={state.status === "reconnect" ? "ghost" : "default"}
              onClick={() => attempt(async () => open(await pickFolder()))}
            >
              {state.status === "reconnect" ? "Choose another folder" : "Choose folder"}
            </Button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-destructive">This browser can’t access local folders. Use Chrome or Edge.</p>
        )}
        {state.error && <p className="mt-3 text-xs text-destructive">{state.error}</p>}
      </div>
    </div>
  );
}
