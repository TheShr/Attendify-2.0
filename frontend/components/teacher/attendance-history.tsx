"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ClassRow = { id: number; class_name: string };
type Row = {
  id: number; date: string; time?: string | null; status: string;
  recognized_name?: string | null; source?: string | null;
  student_id: number; student_name: string; roll_no?: string | null;
  class_id: number; class_name: string;
};

function AttendanceHistory() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string | undefined>(undefined);
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<{ total: number; total_pages: number; page_size: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/api/classes", { cache: "no-store" });
      const json = await res.json();
      if (json?.ok) setClasses(json.data ?? []);
    })();
  }, []);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (classId && classId !== "all") params.set("class_id", classId);
      if (classId === "all") params.set("class_id", "all");
      if (start) params.set("start_date", start);
      if (end) params.set("end_date", end);
      if (q.trim()) params.set("student_query", q.trim());
      params.set("page", String(p));
      params.set("page_size", "20");

      const res = await apiFetch(`/api/attendance/history?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (json?.ok) {
        setRows(json.data ?? []);
        setMeta(json.pagination ?? null);
        setPage(p);
      } else {
        setRows([]);
        setMeta(null);
      }
    } catch (error) {
      console.error(error);
      setRows([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [classId, end, q, start]);

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Attendance History</h3>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger><SelectValue placeholder="Filter by class" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {classes.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.class_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input type="date" value={start} onChange={e=>setStart(e.target.value)} />
        <Input type="date" value={end} onChange={e=>setEnd(e.target.value)} />
        <Input placeholder="Search student/roll" value={q} onChange={e=>setQ(e.target.value)} />
        <div className="flex gap-2">
          <Button onClick={()=>load(1)} disabled={loading}>Apply</Button>
          <Button variant="outline" onClick={()=>{ setClassId(undefined); setStart(""); setEnd(""); setQ(""); load(1); }} disabled={loading}>Reset</Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/50 text-left">
            <th className="p-3">Date</th>
            <th className="p-3">Time</th>
            <th className="p-3">Class</th>
            <th className="p-3">Student</th>
            <th className="p-3">Status</th>
            <th className="p-3">Recognized Name</th>
            <th className="p-3">Source</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && !loading && <tr><td className="p-3 text-muted-foreground" colSpan={7}>No records</td></tr>}
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.date}</td>
                <td className="p-3">{r.time ?? "-"}</td>
                <td className="p-3">{r.class_name}</td>
                <td className="p-3">{r.student_name}{r.roll_no ? ` (${r.roll_no})` : ""}</td>
                <td className="p-3 capitalize">{r.status}</td>
                <td className="p-3">{r.recognized_name ?? "-"}</td>
                <td className="p-3">{r.source ?? "manual"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page} of {meta.total_pages} - {meta.total} records
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={()=> load(Math.max(1, page-1))} disabled={loading || page<=1}>Prev</Button>
            <Button variant="outline" onClick={()=> load(meta ? Math.min(meta.total_pages, page+1) : page+1)} disabled={loading || (meta ? page>=meta.total_pages : false)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AttendanceHistory;
export { AttendanceHistory };
