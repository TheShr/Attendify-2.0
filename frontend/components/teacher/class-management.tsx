"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiFetch, apiJson } from "@/lib/api";

type ClassRow = {
  id: number;
  class_name: string;
  section?: string | null;
  subject?: string | null;
  schedule_info?: string | null;
  created_at: string;
};

function useClasses() {
  const [data, setData] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await apiFetch("/api/classes", { cache: "no-store" });
        const json = await res.json();
        if (alive && json?.ok) setData(json.data ?? []);
      } catch {
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { classes: data, setClasses: setData, loading };
}

function AddClassDialog({ onAdded }: { onAdded: (c: ClassRow) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [class_name, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [subject, setSubject] = useState("");
  const [schedule_info, setScheduleInfo] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const name = class_name.trim();
    if (!name) {
      (toast?.error ?? alert)("Class name is required");
      return;
    }

    try {
      setSaving(true);
      const json = await apiJson<{ data: { id: number; class_name: string; section?: string; subject?: string; schedule_info?: string; created_at: string } }>("/api/classes", {
        method: "POST",
        body: JSON.stringify({
          class_name: name,
          section: section.trim() || undefined,
          subject: subject.trim() || undefined,
          schedule_info: schedule_info.trim() || undefined,
        }),
      });

      onAdded(json.data);
      setClassName("");
      setSection("");
      setSubject("");
      setScheduleInfo("");
      setOpen(false);
      toast?.success?.("Class added");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      (toast?.error ?? alert)(message || "Failed to add class");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add Class</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a class</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="class_name">
              Class name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="class_name"
              value={class_name}
              onChange={(event) => setClassName(event.target.value)}
              placeholder="e.g., Math 101"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="section">Section</Label>
            <Input
              id="section"
              value={section}
              onChange={(event) => setSection(event.target.value)}
              placeholder="e.g., A"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g., Algebra"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="schedule_info">Schedule info</Label>
            <Textarea
              id="schedule_info"
              value={schedule_info}
              onChange={(event) => setScheduleInfo(event.target.value)}
              placeholder="e.g., Mon/Wed/Fri 10:00-11:00"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClassManagement() {
  const { classes, setClasses, loading } = useClasses();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">My Classes</h3>
        <AddClassDialog onAdded={(c) => setClasses((prev) => [c, ...prev])} />
      </div>

      {loading && <div>Loading classes...</div>}

      {!loading && classes.length === 0 && (
        <div className="text-sm text-muted-foreground">No classes yet.</div>
      )}

      <div className="grid gap-3">
        {classes.map((c) => (
          <div key={c.id} className="rounded-xl border p-4">
            <div className="font-medium">
              {c.class_name}
              {c.section ? <span className="text-muted-foreground"> - {c.section}</span> : null}
            </div>
            <div className="text-sm text-muted-foreground">
              {c.subject ? `Subject: ${c.subject}` : ""}
              {c.subject && c.schedule_info ? " - " : ""}
              {c.schedule_info ? `Schedule: ${c.schedule_info}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ClassManagement;
export { ClassManagement };