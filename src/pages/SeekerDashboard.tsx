import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, AlertCircle, CheckCircle, Clock } from "lucide-react";

interface Request {
  id: string;
  seeker_id: string;
  message?: string;
  status: "pending" | "fulfilled" | "cancelled";
  created_at: string;
  blood_type?: string;
  urgency_level?: string;
}

const SeekerDashboard = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    description: "",
    blood_type: "",
    urgency_level: "normal",
  });

  useEffect(() => {
    if (user) {
      loadRequests();
    }
  }, [user]);

  const loadRequests = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("blood_requests")
        .select("*")
        .eq("seeker_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRequests((data as Request[]) || []);
    } catch (error) {
      console.error("Error loading requests:", error);
      toast({
        title: "Error",
        description: "Failed to load your requests. Please try again later.",
        variant: "destructive",
      });
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!user) return;

    if (!formData.description || !formData.blood_type) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      // Create the request - donor_id is set to seeker_id as placeholder (null would be better but schema requires it)
      const newRequest = {
        seeker_id: user.id,
        donor_id: user.id, // Placeholder - will be updated when a donor responds
        message: formData.description,
        blood_type: formData.blood_type,
        urgency_level: formData.urgency_level,
        status: "pending" as const,
      };

      console.log("Creating request:", newRequest);

      const { data, error } = await supabase
        .from("blood_requests")
        .insert([newRequest]);

      if (error) {
        console.error("Error creating request:", error);
        throw error;
      }

      console.log("Request created successfully:", data);

      toast({
        title: "Request created!",
        description: "Your request has been submitted. Donors can now see it and respond.",
      });

      setCreateDialogOpen(false);
      setFormData({
        description: "",
        blood_type: "",
        urgency_level: "normal",
      });
      
      // Reload requests to show the new one
      loadRequests();
    } catch (error: any) {
      console.error("Failed to create request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create request.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    fulfilled: requests.filter((r) => r.status === "fulfilled").length,
    received: requests.filter((r) => r.status === "fulfilled").length, // Same as fulfilled for now
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Seeker Dashboard</h1>
              <p className="text-muted-foreground">Manage your blood donation requests</p>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Request
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Request</DialogTitle>
                  <DialogDescription>
                    Submit a new blood donation request. Donors will be notified.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="blood_type">Blood Type *</Label>
                    <Select
                      value={formData.blood_type}
                      onValueChange={(value) => setFormData({ ...formData, blood_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select blood type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A-">A-</SelectItem>
                        <SelectItem value="B+">B+</SelectItem>
                        <SelectItem value="B-">B-</SelectItem>
                        <SelectItem value="AB+">AB+</SelectItem>
                        <SelectItem value="AB-">AB-</SelectItem>
                        <SelectItem value="O+">O+</SelectItem>
                        <SelectItem value="O-">O-</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="urgency">Urgency Level</Label>
                    <Select
                      value={formData.urgency_level}
                      onValueChange={(value) => setFormData({ ...formData, urgency_level: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Provide details about your request..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCreateDialogOpen(false);
                        setFormData({
                          description: "",
                          blood_type: "",
                          urgency_level: "normal",
                        });
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreateRequest} disabled={creating} className="flex-1">
                      {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit Request
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Status Overview */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Requests</div>
                    <div className="text-3xl font-bold">{stats.total}</div>
                  </div>
                  <AlertCircle className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Pending</div>
                    <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Received</div>
                    <div className="text-3xl font-bold text-green-600">{stats.received}</div>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Requests List */}
          <Card>
            <CardHeader>
              <CardTitle>My Requests</CardTitle>
              <CardDescription>View and manage your blood donation requests</CardDescription>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No requests yet.</p>
                  <p className="text-sm mt-2">Create your first request to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">Blood Donation Request</h3>
                          <Badge
                            variant={
                              request.status === "fulfilled"
                                ? "default"
                                : request.status === "pending"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {request.status}
                          </Badge>
                          {request.blood_type && (
                            <Badge variant="outline">{request.blood_type}</Badge>
                          )}
                        </div>
                        {request.message && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {request.message}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Created: {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SeekerDashboard;
