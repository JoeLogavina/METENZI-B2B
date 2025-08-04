import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Users, Plus, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface User {
  id: string;
  username: string;
  email?: string;
  companyName?: string;
  branchName?: string;
  branchCode?: string;
  branchType: 'main' | 'branch';
  isActive: boolean;
  createdAt: string;
}

interface BranchData {
  mainCompany: User;
  branches: User[];
}

interface BranchManagementProps {
  parentUserId: string;
  parentUserData: any;
}

export function BranchManagement({ parentUserId, parentUserData }: BranchManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newBranch, setNewBranch] = useState({
    username: '',
    password: '',
    email: '',
    branchName: '',
    branchCode: '',
    companyName: '',
    tenantId: 'eur'
  });

  // Fetch branches for the parent user
  const { data: hierarchy, isLoading } = useQuery<{ data: User[] }>({
    queryKey: ['admin', 'users', parentUserId, 'branches'],
    queryFn: () => apiRequest(`/api/admin/users/${parentUserId}/branches`)
  });

  // Create branch mutation
  const createBranchMutation = useMutation({
    mutationFn: async (branchData: typeof newBranch) => {
      // Get CSRF token first
      const csrfResponse = await fetch('/api/csrf-token');
      const { csrfToken } = await csrfResponse.json();
      
      const response = await fetch(`/api/admin/users/${parentUserId}/branches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(branchData)
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to create branch' }));
        throw new Error(error.message || 'Failed to create branch');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Branch created successfully"
      });
      setShowCreateDialog(false);
      setNewBranch({
        username: '',
        password: '',
        email: '',
        branchName: '',
        branchCode: '',
        companyName: '',
        tenantId: 'eur'
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', parentUserId, 'branches'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create branch",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBranchMutation.mutate(newBranch);
  };

  if (isLoading) {
    return <div className="p-6">Loading company hierarchy...</div>;
  }

  // Extract branches data and use parent user data as main company
  const branches = hierarchy?.data || [];
  const mainCompany = parentUserData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Branch Management</h2>
            <p className="text-gray-600">Manage company branches and hierarchy</p>
          </div>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-spanish-yellow hover:bg-spanish-yellow/90 text-black">
              <Plus className="h-4 w-4 mr-2" />
              Create Branch
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Branch</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="branchName">Branch Name</Label>
                <Input
                  id="branchName"
                  value={newBranch.branchName}
                  onChange={(e) => setNewBranch({ ...newBranch, branchName: e.target.value })}
                  placeholder="Enter branch name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={newBranch.username}
                  onChange={(e) => setNewBranch({ ...newBranch, username: e.target.value })}
                  placeholder="Enter username"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newBranch.password}
                  onChange={(e) => setNewBranch({ ...newBranch, password: e.target.value })}
                  placeholder="Enter password"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={newBranch.email}
                  onChange={(e) => setNewBranch({ ...newBranch, email: e.target.value })}
                  placeholder="Enter email"
                />
              </div>
              <div>
                <Label htmlFor="branchCode">Branch Code (Optional)</Label>
                <Input
                  id="branchCode"
                  value={newBranch.branchCode}
                  onChange={(e) => setNewBranch({ ...newBranch, branchCode: e.target.value })}
                  placeholder="Enter branch code"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-spanish-yellow hover:bg-spanish-yellow/90 text-black"
                disabled={createBranchMutation.isPending}
              >
                {createBranchMutation.isPending ? 'Creating...' : 'Create Branch'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Company Card */}
      <Card className="border-2 border-spanish-yellow">
        <CardHeader className="bg-spanish-yellow/10">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Main Company
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-600">Company Name</Label>
              <p className="font-semibold">{mainCompany.companyName || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Username</Label>
              <p className="font-semibold">{mainCompany.username}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Email</Label>
              <p className="font-semibold">{mainCompany.email || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Status</Label>
              <Badge variant={mainCompany.isActive ? "default" : "secondary"}>
                {mainCompany.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-600">Main company account</p>
          </div>
        </CardContent>
      </Card>

      {/* Branches Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          <h3 className="text-lg font-semibold">
            Branches ({branches.length})
          </h3>
        </div>

        {branches.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No branches found</h3>
              <p className="text-gray-600 mb-4">Create the first branch to get started</p>
              <Button 
                onClick={() => setShowCreateDialog(true)}
                className="bg-spanish-yellow hover:bg-spanish-yellow/90 text-black"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Branch
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {branches.map((branch) => (
              <Card key={branch.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Branch Name</Label>
                      <p className="font-semibold">{branch.branchName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Username</Label>
                      <p className="font-semibold">{branch.username}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Branch Code</Label>
                      <p className="font-semibold">{branch.branchCode || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Status</Label>
                      <Badge variant={branch.isActive ? "default" : "secondary"}>
                        {branch.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">Branch User</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}