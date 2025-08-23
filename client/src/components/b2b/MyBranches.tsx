import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Building2, 
  Users, 
  Plus, 
  MapPin, 
  Mail, 
  User as UserIcon,
  Shield,
  Briefcase
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface MyBranchesProps {
  // Component can be used standalone or as part of a larger interface
}

export function MyBranches({}: MyBranchesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newBranch, setNewBranch] = useState({
    username: '',
    password: '',
    email: '',
    branchName: '',
    branchCode: '',
    companyName: user?.companyName || '',
    tenantId: user?.tenantId || 'eur'
  });

  // Determine the parent company ID
  // If user is a branch, use their parent; if main company, use their own ID
  const parentCompanyId = user?.branchType === 'branch' ? user?.parentCompanyId : user?.id;

  // Fetch company hierarchy
  const { data: hierarchy, isLoading } = useQuery<{ data: { mainCompany: User; branches: User[] } }>({
    queryKey: ['my-company-hierarchy', parentCompanyId],
    queryFn: () => apiRequest('GET', `/api/users/${parentCompanyId}/hierarchy`),
    enabled: !!parentCompanyId
  });

  // Create branch mutation
  const createBranchMutation = useMutation({
    mutationFn: async (branchData: typeof newBranch) => {
      const response = await fetch(`/api/users/${parentCompanyId}/branches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
        companyName: user?.companyName || '',
        tenantId: user?.tenantId || 'eur'
      });
      queryClient.invalidateQueries({ queryKey: ['my-company-hierarchy', parentCompanyId] });
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
    return <div className="p-6">Loading company information...</div>;
  }

  if (!hierarchy?.data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No company data found</h3>
            <p className="text-gray-600">Unable to load company information</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { mainCompany, branches } = hierarchy.data;
  const isMainCompany = user?.branchType === 'main_company' || user?.id === mainCompany.id;
  const isBranchUser = user?.branchType === 'branch';

  // If user is a branch, show only their profile information
  if (isBranchUser) {
    const currentBranch = branches.find(branch => branch.id === user?.id);
    
    return (
      <div className="space-y-6">
        {/* Header for Branch User */}
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-[#FFB20F]" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">My Branch Profile</h2>
            <p className="text-gray-600">Your branch information and access details</p>
          </div>
        </div>

        {/* Current Branch Card */}
        {currentBranch && (
          <Card className="border-l-4 border-l-[#FFB20F]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Branch Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Branch Name</Label>
                  <p className="font-semibold">{currentBranch.branchName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Username</Label>
                  <p className="font-semibold">{currentBranch.username}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Email</Label>
                  <p className="font-semibold">{currentBranch.email || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Branch Code</Label>
                  <p className="font-semibold">{currentBranch.branchCode || 'N/A'}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Badge variant="default" className="bg-[#FFB20F] text-black">
                  Branch User
                </Badge>
                <Badge variant={currentBranch.isActive ? "default" : "secondary"}>
                  {currentBranch.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Access Information */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">Branch Access & Resources</h4>
                <p className="text-sm text-blue-700">
                  As a branch user, you have access to the product catalog, can place orders, and manage transactions. 
                  Your activities contribute to the main company's overall business operations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main company view (existing layout)
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-[#FFB20F]" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">My Company & Branches</h2>
            <p className="text-gray-600">Manage your company structure and branch locations</p>
          </div>
        </div>

        {isMainCompany && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-[#FFB20F] hover:bg-[#e6a00e] text-black">
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
                  <Label htmlFor="branchName">Branch Name *</Label>
                  <Input
                    id="branchName"
                    value={newBranch.branchName}
                    onChange={(e) => setNewBranch({ ...newBranch, branchName: e.target.value })}
                    placeholder="e.g., Munich Office"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="branchCode">Branch Code</Label>
                  <Input
                    id="branchCode"
                    value={newBranch.branchCode}
                    onChange={(e) => setNewBranch({ ...newBranch, branchCode: e.target.value })}
                    placeholder="e.g., MUN01"
                  />
                </div>
                <div>
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={newBranch.username}
                    onChange={(e) => setNewBranch({ ...newBranch, username: e.target.value })}
                    placeholder="Branch login username"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newBranch.password}
                    onChange={(e) => setNewBranch({ ...newBranch, password: e.target.value })}
                    placeholder="Minimum 6 characters"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newBranch.email}
                    onChange={(e) => setNewBranch({ ...newBranch, email: e.target.value })}
                    placeholder="branch@company.com"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-[#FFB20F] hover:bg-[#e6a00e] text-black"
                  disabled={createBranchMutation.isPending}
                >
                  {createBranchMutation.isPending ? 'Creating...' : 'Create Branch'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Main Company Card */}
      <Card className="border-l-4 border-l-[#FFB20F]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Main Company
          </CardTitle>
        </CardHeader>
        <CardContent>
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
          <div className="mt-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-600" />
            <p className="text-sm text-gray-600">Main company account with full access</p>
          </div>
        </CardContent>
      </Card>

      {/* Branches Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          <h3 className="text-lg font-semibold">
            Branch Locations ({branches.length})
          </h3>
        </div>

        {branches.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No branches found</h3>
              <p className="text-gray-600 mb-4">
                {isMainCompany 
                  ? "Create your first branch location to expand your business reach" 
                  : "This company hasn't created any branch locations yet"}
              </p>
              {isMainCompany && (
                <Button 
                  onClick={() => setShowCreateDialog(true)}
                  className="bg-[#FFB20F] hover:bg-[#e6a00e] text-black"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Branch
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {branches.map((branch) => (
              <Card key={branch.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#FFB20F]" />
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Branch Name</Label>
                        <p className="font-semibold">{branch.branchName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-gray-500" />
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Username</Label>
                        <p className="font-semibold">{branch.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-gray-500" />
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Branch Code</Label>
                        <p className="font-semibold">{branch.branchCode || 'N/A'}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Status</Label>
                      <Badge variant={branch.isActive ? "default" : "secondary"}>
                        {branch.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-blue-600 border-blue-200">
                        Branch User
                      </Badge>
                      {user?.id === branch.id && (
                        <Badge variant="default" className="bg-[#FFB20F] text-black">
                          Current
                        </Badge>
                      )}
                    </div>
                  </div>
                  {branch.email && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span>{branch.email}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Access Information */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Shared Access & Resources</h4>
              <p className="text-sm text-blue-700">
                All branches share the same product catalog, pricing, and wallet balance. 
                Each branch can place orders and manage their own transactions while contributing to the main company's activity.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default MyBranches;