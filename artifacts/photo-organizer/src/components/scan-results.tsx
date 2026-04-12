import { ScanResponse, FileMetadata } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Calendar, FileType, CheckCircle2, AlertCircle, Play, Image as ImageIcon, Copy, ArrowRight } from "lucide-react";

interface ScanResultsProps {
  scanData: ScanResponse;
  onProcessClick: () => void;
  onStartOver: () => void;
}

export function ScanResults({ scanData, onProcessClick, onStartOver }: ScanResultsProps) {
  const { summary, files, totalFiles } = scanData;

  const renderFileRow = (file: FileMetadata, idx: number) => {
    return (
      <TableRow key={idx} className={file.error ? "bg-destructive/5" : ""}>
        <TableCell className="font-medium max-w-[200px] truncate" title={file.originalName}>
          <div className="flex items-center gap-2">
            {file.fileType === "video" ? <Play className="w-4 h-4 text-muted-foreground" /> : <ImageIcon className="w-4 h-4 text-muted-foreground" />}
            <span className="truncate">{file.originalName}</span>
          </div>
        </TableCell>
        <TableCell>
          {file.year && file.month ? (
            <div className="flex items-center gap-1 text-sm">
              <Calendar className="w-3 h-3 text-primary" />
              {file.year}-{file.month}
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">Unknown Date</span>
          )}
        </TableCell>
        <TableCell>
          {file.location ? (
            <div className="flex items-center gap-1 text-sm">
              <MapPin className="w-3 h-3 text-primary" />
              <span className="truncate max-w-[150px] block" title={file.location}>{file.location}</span>
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">No Location</span>
          )}
        </TableCell>
        <TableCell className="font-mono text-xs text-muted-foreground">
          {file.targetPath}
        </TableCell>
        <TableCell className="text-right">
          {file.error ? (
            <Badge variant="destructive" className="flex items-center gap-1 ml-auto w-fit">
              <AlertCircle className="w-3 h-3" /> Error
            </Badge>
          ) : file.isDuplicate ? (
            <Badge variant="secondary" className="flex items-center gap-1 ml-auto w-fit">
              <Copy className="w-3 h-3" /> Duplicate
            </Badge>
          ) : (
            <Badge variant="default" className="flex items-center gap-1 ml-auto w-fit bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" /> Ready
            </Badge>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Scan Complete</h2>
          <p className="text-muted-foreground text-sm">We analyzed {totalFiles} files. Here's what we found.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onStartOver} data-testid="button-start-over">Start Over</Button>
          <Button onClick={onProcessClick} className="gap-2" data-testid="button-process">
            Organize Files <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-4xl font-light text-primary">{summary.images + summary.videos}</CardTitle>
            <CardDescription>Valid Media Files</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-4xl font-light">{summary.withDate}</CardTitle>
            <CardDescription>Have Date Data</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-4xl font-light">{summary.withGps}</CardTitle>
            <CardDescription>Have GPS Data</CardDescription>
          </CardHeader>
        </Card>
        <Card className={summary.errors > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-4xl font-light ${summary.errors > 0 ? "text-destructive" : ""}`}>{summary.errors}</CardTitle>
            <CardDescription>Errors / Unknown</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-border/50">
        <CardHeader className="py-4 bg-muted/20 border-b border-border/50">
          <CardTitle className="text-base font-medium flex items-center justify-between">
            File Preview
            <Badge variant="outline" className="font-mono">{files.length} items</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0 relative">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Detected Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Target Path</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file, idx) => renderFileRow(file, idx))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
