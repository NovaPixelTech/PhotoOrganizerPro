import type { FileMeta } from "@/lib/exif-extractor";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Calendar, Play, Image as ImageIcon, CheckCircle2, AlertCircle, Copy, ArrowRight } from "lucide-react";

interface ScanResultsProps {
  files: FileMeta[];
  onProcessClick: () => void;
  onStartOver: () => void;
}

export function ScanResults({ files, onProcessClick, onStartOver }: ScanResultsProps) {
  const images    = files.filter((f) => f.kind === "image").length;
  const videos    = files.filter((f) => f.kind === "video").length;
  const withGps   = files.filter((f) => f.lat !== null).length;
  const withDate  = files.filter((f) => f.year !== null).length;
  const dups      = files.filter((f) => f.isDuplicate).length;
  const errs      = files.filter((f) => f.error !== null).length;

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Scan Complete</h2>
          <p className="text-muted-foreground text-sm">
            Analysed {files.length} file{files.length !== 1 ? "s" : ""}. Here's what we found.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onStartOver}>Start Over</Button>
          <Button onClick={onProcessClick} className="gap-2">
            Organize Files <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: "Images", value: images },
          { label: "Videos", value: videos },
          { label: "With Date", value: withDate },
          { label: "With GPS", value: withGps },
          { label: "Duplicates", value: dups },
          { label: "Errors", value: errs, bad: errs > 0 },
        ].map(({ label, value, bad }) => (
          <Card key={label} className={bad ? "border-destructive/50 bg-destructive/5" : ""}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className={`text-3xl font-light ${bad ? "text-destructive" : "text-primary"}`}>{value}</CardTitle>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-border/50">
        <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">File Preview</CardTitle>
            <Badge variant="outline" className="font-mono text-xs">{files.length} items</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Target Path</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((f, i) => (
                  <TableRow key={i} className={f.error ? "bg-destructive/5" : ""}>
                    <TableCell className="max-w-[180px]">
                      <div className="flex items-center gap-2">
                        {f.kind === "video"
                          ? <Play className="w-3 h-3 shrink-0 text-muted-foreground" />
                          : <ImageIcon className="w-3 h-3 shrink-0 text-muted-foreground" />}
                        <span className="truncate text-sm" title={f.originalName}>{f.file.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {f.year && f.month
                        ? <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-primary" />{f.year}-{f.month}</span>
                        : <span className="text-muted-foreground">Unknown</span>}
                    </TableCell>
                    <TableCell className="text-sm max-w-[160px]">
                      {f.location
                        ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-primary shrink-0" /><span className="truncate" title={`${f.lat?.toFixed(4)}, ${f.lon?.toFixed(4)}`}>{f.location}</span></span>
                        : f.lat !== null
                        ? <span className="flex items-center gap-1 text-amber-500"><MapPin className="w-3 h-3 shrink-0" /><span className="truncate font-mono text-xs">{f.lat.toFixed(4)},{f.lon?.toFixed(4)}</span></span>
                        : <span className="text-muted-foreground">No GPS</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px]">
                      <span className="truncate block" title={f.targetFolder ?? ""}>{f.targetFolder}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {f.error
                        ? <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" />Error</Badge>
                        : f.isDuplicate
                        ? <Badge variant="secondary" className="gap-1"><Copy className="w-3 h-3" />Duplicate</Badge>
                        : <Badge className="gap-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-0"><CheckCircle2 className="w-3 h-3" />Ready</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
