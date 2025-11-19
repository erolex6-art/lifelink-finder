import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets, AlertCircle, Loader2, Heart } from "lucide-react";

interface Request {
  id: string;
  seeker_id: string;
  message?: string;
  status: "pending" | "fulfilled" | "cancelled";
  created_at: string;
  blood_type?: string;
  urgency_level?: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

const DonorDashboard = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [donating, setDonating] = useState<string | null>(null);
  const [donationUnits, setDonationUnits] = useState("");
  const [donationNote, setDonationNote] = useState("");
  const [donationDialogOpen, setDonationDialogOpen] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      // Fetch ALL pending requests from database (any seeker's requests)
      const { data, error } = await supabase
        .from("blood_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      console.log("Loaded blood requests:", data);

      // Load profiles for each request to get seeker names
      const requestsWithProfiles = await Promise.all(
        (data || []).map(async (request: any) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", request.seeker_id)
            .single();

          return {
            ...request,
            profiles: profileData || { full_name: "Anonymous", email: "" }
          };
        })
      );

      setRequests(requestsWithProfiles as Request[]);
    } catch (error) {
      console.error("Error loading requests:", error);
      toast({
        title: "Error loading requests",
        description: "Unable to fetch blood requests. Please try again later.",
        variant: "destructive",
      });
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDonate = async (requestId: string, request: Request) => {
    if (!user) return;

    const units = parseFloat(donationUnits || "0");
    if (isNaN(units) || units <= 0) {
      toast({
        title: "Invalid units",
        description: "Please enter a valid number of blood units.",
        variant: "destructive",
      });
      return;
    }

    setDonating(requestId);
    try {
      // Update request: set donor and mark fulfilled
      const { error: updateError } = await supabase
        .from("blood_requests")
        .update({ status: "fulfilled", donor_id: user.id })
        .eq("id", requestId);

      if (updateError) throw updateError;

      // Insert a notification for the seeker so they know a donor committed
      const seekerId = request.seeker_id;
      const donorName = (profile && profile.full_name) || "A donor";
      const message = `${donorName} has pledged ${units} unit(s) of ${request.blood_type || "blood"}. ${donationNote || ""}`;

      const { error: notifError } = await supabase.from("notifications").insert([
        {
          user_id: seekerId,
          title: "Blood donation pledged",
          message,
          type: "donation",
          related_request_id: requestId,
        },
      ]);

      if (notifError) throw notifError;

      toast({
        title: "Thank you!",
        description: `You pledged ${units} unit(s). The seeker has been notified.`,
      });

      setDonationDialogOpen(null);
      setDonationUnits("");
      setDonationNote("");
      loadRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to record donation.",
        variant: "destructive",
      });
    } finally {
      setDonating(null);
    }
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
          <div>
            <h1 className="text-3xl font-bold">Donor Dashboard</h1>
            <p className="text-muted-foreground">Help those in urgent need</p>
          </div>

          {/* Welcome Card */}
          {profile && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Heart className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Welcome, {profile.full_name}!</h2>
                    <p className="text-muted-foreground">Thank you for being a donor. Your generosity saves lives.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Urgent Needs Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <h2 className="text-2xl font-semibold">Urgent Needs</h2>
            </div>

            {requests.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8 text-muted-foreground">
                    <Droplets className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No urgent requests at the moment.</p>
                    <p className="text-sm mt-2">Check back later to help those in need.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {requests.map((request) => (
                  <Card key={request.id} className="hover:shadow-elevated transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">
                            Blood Donation Request
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {request.profiles?.full_name || "Anonymous Seeker"}
                          </CardDescription>
                        </div>
                        <Badge
                          variant={
                            request.urgency_level === "high"
                              ? "destructive"
                              : request.urgency_level === "medium"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {request.urgency_level || "Normal"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {request.message && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {request.message}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          <Droplets className="h-3 w-3 mr-1" />
                          {request.blood_type || "Any"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <Dialog
                        open={donationDialogOpen === request.id}
                        onOpenChange={(open) => {
                          setDonationDialogOpen(open ? request.id : null);
                          if (!open) {
                            setDonationUnits("");
                            setDonationNote("");
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="hero" className="w-full">
                            <Heart className="h-4 w-4 mr-2" />
                            Pledge Blood
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Record Blood Donation</DialogTitle>
                            <DialogDescription>
                              Confirm how many units you're pledging and add an optional note.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="units">Units (e.g. 1)</Label>
                              <Input
                                id="units"
                                type="number"
                                min="1"
                                step="1"
                                placeholder="1"
                                value={donationUnits}
                                onChange={(e) => setDonationUnits(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="note">Note (optional)</Label>
                              <Input
                                id="note"
                                placeholder="Any message or contact info"
                                value={donationNote}
                                onChange={(e) => setDonationNote(e.target.value)}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setDonationDialogOpen(null);
                                  setDonationUnits("");
                                  setDonationNote("");
                                }}
                                className="flex-1"
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => handleDonate(request.id, request)}
                                disabled={donating === request.id}
                                className="flex-1"
                              >
                                {donating === request.id && (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Confirm Pledge
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonorDashboard;
