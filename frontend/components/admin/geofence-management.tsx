"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Plus, Trash2, RefreshCw, Save, X } from "lucide-react"
import { apiJson, apiFetch } from "@/lib/api"

interface GeofenceZone {
  id: number
  name: string
  lat: number
  lon: number
  radius_meters: number
  is_active: boolean
  created_at: string
}

interface ZoneForm {
  name: string
  lat: string
  lon: string
  radius_meters: string
}

const EMPTY_FORM: ZoneForm = { name: "", lat: "", lon: "", radius_meters: "100" }

export function GeofenceManagement() {
  const [zones, setZones] = useState<GeofenceZone[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ZoneForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiJson<GeofenceZone[] | { zones: GeofenceZone[] }>("/geofences")
      setZones(Array.isArray(data) ? data : data.zones ?? [])
    } catch { setZones([]) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.name || !form.lat || !form.lon || !form.radius_meters) {
      setError("All fields are required."); return
    }
    setSaving(true)
    try {
      const res = await apiFetch("/api/geofences", {
        method: "POST",
        body: JSON.stringify({ name: form.name, lat: Number(form.lat), lon: Number(form.lon), radius_meters: Number(form.radius_meters) }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d?.error || "Failed") }
      setForm(EMPTY_FORM)
      setShowForm(false)
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to create zone") }
    finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this geofence zone?")) return
    setDeletingId(id)
    try {
      await apiFetch(`/api/geofences/${id}`, { method: "DELETE" })
      await load()
    } catch { alert("Failed to delete zone") }
    finally { setDeletingId(null) }
  }

  return (
    <Card style={{border:"1px solid #e8edf5",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
      <CardHeader style={{padding:"20px 24px 16px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <CardTitle style={{display:"flex",alignItems:"center",gap:8,fontSize:16,fontWeight:700,color:"#111827"}}>
            <MapPin size={17} color="#8b5cf6" /> Geofence Zones
          </CardTitle>
          <div style={{display:"flex",gap:8}}>
            <button onClick={load} style={{padding:"6px 8px",border:"1px solid #e8edf5",borderRadius:8,background:"white",cursor:"pointer",color:"#6b7a99",display:"flex",alignItems:"center"}} title="Refresh">
              <RefreshCw size={13} />
            </button>
            <button onClick={() => { setShowForm(!showForm); setError(null) }} style={{padding:"6px 14px",background:showForm?"#f1f5f9":"#111827",border:"none",borderRadius:8,color:showForm?"#374151":"white",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
              {showForm ? <><X size={13}/> Cancel</> : <><Plus size={13}/> New Zone</>}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent style={{padding:"0 24px 24px"}}>
        {showForm && (
          <form onSubmit={handleCreate} style={{background:"#f8fafc",border:"1px solid #e8edf5",borderRadius:10,padding:18,marginBottom:20}}>
            <p style={{fontSize:13,fontWeight:700,color:"#111827",marginBottom:14}}>Create New Zone</p>
            {error && <p style={{fontSize:12,color:"#ef4444",marginBottom:10}}>⚠ {error}</p>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[
                { label: "Zone Name", key: "name", placeholder: "e.g. Main Campus", span: 2 },
                { label: "Latitude", key: "lat", placeholder: "28.6139" },
                { label: "Longitude", key: "lon", placeholder: "77.2090" },
                { label: "Radius (meters)", key: "radius_meters", placeholder: "100" },
              ].map((f) => (
                <div key={f.key} style={{gridColumn: f.span === 2 ? "span 2" : undefined}}>
                  <label style={{display:"block",fontSize:11,fontWeight:600,color:"#6b7a99",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:5}}>{f.label}</label>
                  <input
                    style={{width:"100%",padding:"9px 12px",fontSize:13,border:"1px solid #e2e8f0",borderRadius:7,outline:"none",color:"#111827",background:"white"}}
                    placeholder={f.placeholder}
                    value={(form as unknown as Record<string,string>)[f.key]}
                    onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))}
                  />
                </div>
              ))}
            </div>
            <button type="submit" disabled={saving} style={{marginTop:14,padding:"9px 18px",background:"linear-gradient(135deg,#0ea5e9,#6366f1)",border:"none",borderRadius:8,color:"white",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6,opacity:saving?0.6:1}}>
              <Save size={13} /> {saving ? "Saving…" : "Create Zone"}
            </button>
          </form>
        )}

        {loading ? (
          <div style={{textAlign:"center",padding:32,color:"#9ca3b8",fontSize:13}}>Loading zones…</div>
        ) : zones.length === 0 ? (
          <div style={{textAlign:"center",padding:32,color:"#9ca3b8",fontSize:13}}>No geofence zones configured yet.</div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {zones.map((z) => (
              <div key={z.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"#f8fafc",border:"1px solid #e8edf5",borderRadius:10}}>
                <div style={{width:36,height:36,background:z.is_active?"#f0fdf4":"#f8fafc",border:`1px solid ${z.is_active?"#bbf7d0":"#e8edf5"}`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <MapPin size={16} color={z.is_active?"#10b981":"#9ca3b8"} />
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:14,fontWeight:700,color:"#111827"}}>{z.name}</span>
                    <Badge style={{fontSize:10,padding:"1px 7px",background:z.is_active?"#f0fdf4":"#f1f5f9",color:z.is_active?"#10b981":"#9ca3b8",border:"none"}}>{z.is_active?"Active":"Inactive"}</Badge>
                  </div>
                  <span style={{fontSize:12,color:"#9ca3b8"}}>
                    {z.lat?.toFixed(5)}, {z.lon?.toFixed(5)} · {z.radius_meters}m radius
                  </span>
                </div>
                <button onClick={() => handleDelete(z.id)} disabled={deletingId === z.id} style={{width:30,height:30,border:"none",background:"none",cursor:"pointer",color:"#d1d5db",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",transition:"color 0.15s,background 0.15s"}}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color="#ef4444"; (e.currentTarget as HTMLElement).style.background="#fff0f0" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color="#d1d5db"; (e.currentTarget as HTMLElement).style.background="none" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
