import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Building, MapPin, Phone, Edit, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@shared/schema';
import { useAuth } from '@/hooks/useAuth';

interface BranchFormData {
  username: string;
  branchName: string;
  branchCode: string;
  branchDescription?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  country?: string;
  city?: string;
  address?: string;
}

export function MyBranches() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<User | null>(null);
  const [formData, setFormData] = useState<BranchFormData>({
    username: '',
    branchName: '',
    branchCode: '',
    branchDescription: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    contactPerson: '',
    country: '',
    city: '',
    address: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch branches for the current user
  const { data: branchesData, isLoading } = useQuery({
    queryKey: ['/api/admin/users', user?.id, 'branches'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${user?.id}/branches`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch branches');
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Create branch mutation
  const createBranchMutation = useMutation({
    mutationFn: async (data: BranchFormData) => {
      const response = await fetch(`/api/admin/users/${user?.id}/branches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create branch');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', user?.id, 'branches'] });
      setIsCreateOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Branch created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to create branch',
      });
    },
  });

  // Update branch mutation
  const updateBranchMutation = useMutation({
    mutationFn: async (data: { branchId: string; updateData: Partial<BranchFormData> }) => {
      const response = await fetch(`/api/admin/users/${user?.id}/branches/${data.branchId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data.updateData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update branch');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', user?.id, 'branches'] });
      setIsEditOpen(false);
      setSelectedBranch(null);
      resetForm();
      toast({
        title: 'Success',
        description: 'Branch updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update branch',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      username: '',
      branchName: '',
      branchCode: '',
      branchDescription: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      contactPerson: '',
      country: '',
      city: '',
      address: '',
    });
  };

  const handleCreateBranch = () => {
    setIsCreateOpen(true);
    resetForm();
  };

  const handleEditBranch = (branch: User) => {
    setSelectedBranch(branch);
    setFormData({
      username: branch.username || '',
      branchName: branch.branchName || '',
      branchCode: branch.branchCode || '',
      branchDescription: branch.branchDescription || '',
      firstName: branch.firstName || '',
      lastName: branch.lastName || '',
      email: branch.email || '',
      phone: branch.phone || '',
      contactPerson: branch.contactPerson || '',
      country: branch.country || '',
      city: branch.city || '',
      address: branch.address || '',
    });
    setIsEditOpen(true);
  };

  const handleSubmit = () => {
    if (isEditOpen && selectedBranch) {
      updateBranchMutation.mutate({
        branchId: selectedBranch.id,
        updateData: formData,
      });
    } else {
      createBranchMutation.mutate(formData);
    }
  };

  const branches = branchesData?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-corporate-gray">My Branches</h1>
          <p className="text-gray-600">Manage your company branches</p>
        </div>
        <Button onClick={handleCreateBranch} className="bg-spanish-yellow hover:bg-spanish-yellow/90 text-black">
          <Plus className="h-4 w-4 mr-2" />
          Add Branch
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading branches...</div>
      ) : branches.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Building className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No branches yet</h3>
            <p className="text-gray-600 mb-4">Create your first branch to get started</p>
            <Button onClick={handleCreateBranch} className="bg-spanish-yellow hover:bg-spanish-yellow/90 text-black">
              <Plus className="h-4 w-4 mr-2" />
              Create First Branch
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch: User) => (
            <Card key={branch.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{branch.branchName}</CardTitle>
                    <CardDescription className="font-mono text-sm text-corporate-gray">
                      {branch.branchCode}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditBranch(branch)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
                {branch.branchDescription && (
                  <p className="text-sm text-gray-600 mt-2">{branch.branchDescription}</p>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {branch.contactPerson && (
                    <div className="flex items-center text-sm">
                      <span className="font-medium mr-2">Contact:</span>
                      <span>{branch.contactPerson}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center text-sm">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                  {branch.city && branch.country && (
                    <div className="flex items-center text-sm">
                      <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{branch.city}, {branch.country}</span>
                    </div>
                  )}
                  {branch.email && (
                    <div className="text-sm text-gray-600">
                      {branch.email}
                    </div>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    branch.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Branch Dialog */}
      <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setIsEditOpen(false);
          setSelectedBranch(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditOpen ? 'Edit Branch' : 'Create New Branch'}
            </DialogTitle>
            <DialogDescription>
              {isEditOpen 
                ? 'Update branch information' 
                : 'Add a new branch to your company'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="branch_username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branchCode">Branch Code *</Label>
                <Input
                  id="branchCode"
                  value={formData.branchCode}
                  onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                  placeholder="SAR001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branchName">Branch Name *</Label>
              <Input
                id="branchName"
                value={formData.branchName}
                onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                placeholder="Sarajevo Downtown Office"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branchDescription">Description</Label>
              <Textarea
                id="branchDescription"
                value={formData.branchDescription}
                onChange={(e) => setFormData({ ...formData, branchDescription: e.target.value })}
                placeholder="Optional branch description"
                rows={2}
              />
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input
                id="contactPerson"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              />
            </div>

            {/* Location Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                setIsEditOpen(false);
                setSelectedBranch(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.username || !formData.branchName || !formData.branchCode}
              className="bg-spanish-yellow hover:bg-spanish-yellow/90 text-black"
            >
              {isEditOpen ? 'Update Branch' : 'Create Branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}