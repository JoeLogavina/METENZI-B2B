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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Building, MapPin, Phone, Edit, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { User, InsertBranch } from '@shared/schema';

interface BranchManagerProps {
  userId: string;
  companyName: string;
}

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

export function BranchManager({ userId, companyName }: BranchManagerProps) {
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

  // Fetch branches for the user
  const { data: branchesData, isLoading } = useQuery({
    queryKey: ['/api/admin/users', userId, 'branches'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${userId}/branches`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch branches');
      return response.json();
    },
  });

  // Create branch mutation
  const createBranchMutation = useMutation({
    mutationFn: async (data: BranchFormData) => {
      const response = await fetch(`/api/admin/users/${userId}/branches`, {
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
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', userId, 'branches'] });
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
      const response = await fetch(`/api/admin/users/${userId}/branches/${data.branchId}`, {
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
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', userId, 'branches'] });
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

  // Delete branch mutation
  const deleteBranchMutation = useMutation({
    mutationFn: async (branchId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/branches/${branchId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete branch');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', userId, 'branches'] });
      toast({
        title: 'Success',
        description: 'Branch deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete branch',
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

  const handleDeleteBranch = (branchId: string) => {
    if (confirm('Are you sure you want to delete this branch?')) {
      deleteBranchMutation.mutate(branchId);
    }
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
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Branch Management
            </CardTitle>
            <CardDescription>
              Manage branches for {companyName}
            </CardDescription>
          </div>
          <Button onClick={handleCreateBranch} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Branch
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">Loading branches...</div>
        ) : branches.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No branches found for this company.</p>
            <p className="text-sm">Click "Add Branch" to create the first branch.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-corporate-gray text-white">
                  <TableHead className="text-white font-medium">Branch Code</TableHead>
                  <TableHead className="text-white font-medium">Branch Name</TableHead>
                  <TableHead className="text-white font-medium">Contact</TableHead>
                  <TableHead className="text-white font-medium">Location</TableHead>
                  <TableHead className="text-white font-medium">Status</TableHead>
                  <TableHead className="text-white font-medium text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((branch: User) => (
                  <tr key={branch.id} className="border-b border-gray-200 text-sm">
                    <TableCell className="font-mono font-medium text-corporate-gray">
                      {branch.branchCode}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{branch.branchName}</div>
                        {branch.branchDescription && (
                          <div className="text-xs text-muted-foreground">
                            {branch.branchDescription}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {branch.contactPerson && (
                          <div className="text-xs">{branch.contactPerson}</div>
                        )}
                        {branch.phone && (
                          <div className="flex items-center gap-1 text-xs">
                            <Phone className="h-3 w-3" />
                            {branch.phone}
                          </div>
                        )}
                        {branch.email && (
                          <div className="text-xs text-muted-foreground">
                            {branch.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {branch.city && branch.country && (
                        <div className="flex items-center gap-1 text-xs">
                          <MapPin className="h-3 w-3" />
                          {branch.city}, {branch.country}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        branch.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {branch.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditBranch(branch)}
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBranch(branch.id)}
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

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
                : 'Add a new branch to this company'
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
            >
              {isEditOpen ? 'Update Branch' : 'Create Branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}