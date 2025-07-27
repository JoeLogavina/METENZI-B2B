import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const userFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  role: z.enum(["b2b_user", "admin", "super_admin"]),
  isActive: z.boolean().default(true),
});

type UserFormData = z.infer<typeof userFormSchema>;

interface UserFormProps {
  user?: any;
  onSubmit: (data: UserFormData) => Promise<void>;
  onCancel: () => void;
}

export default function UserForm({ user, onSubmit, onCancel }: UserFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      password: "",
      role: user?.role || "b2b_user",
      isActive: user?.isActive ?? true,
    },
  });

  const handleSubmit = async (data: UserFormData) => {
    setIsSubmitting(true);
    try {
      // Don't send password if it's empty for existing users
      if (user && !data.password) {
        delete data.password;
      }
      
      await onSubmit(data);
      toast({
        title: "Success",
        description: user ? "User updated successfully" : "User created successfully",
      });
      onCancel();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save user",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#6E6F71] uppercase tracking-[0.5px] text-xs font-medium">
                  First Name
                </FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    className="border-gray-300 focus:border-[#FFB20F] focus:ring-[#FFB20F]"
                    placeholder="Enter first name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[#6E6F71] uppercase tracking-[0.5px] text-xs font-medium">
                  Last Name
                </FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    className="border-gray-300 focus:border-[#FFB20F] focus:ring-[#FFB20F]"
                    placeholder="Enter last name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[#6E6F71] uppercase tracking-[0.5px] text-xs font-medium">
                Username
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  className="border-gray-300 focus:border-[#FFB20F] focus:ring-[#FFB20F]"
                  placeholder="Enter username"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[#6E6F71] uppercase tracking-[0.5px] text-xs font-medium">
                Email
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  type="email"
                  className="border-gray-300 focus:border-[#FFB20F] focus:ring-[#FFB20F]"
                  placeholder="Enter email address"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[#6E6F71] uppercase tracking-[0.5px] text-xs font-medium">
                Password {user && "(Leave blank to keep current password)"}
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  type="password"
                  className="border-gray-300 focus:border-[#FFB20F] focus:ring-[#FFB20F]"
                  placeholder={user ? "Leave blank to keep current" : "Enter password"}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[#6E6F71] uppercase tracking-[0.5px] text-xs font-medium">
                Role
              </FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="border-gray-300 focus:border-[#FFB20F] focus:ring-[#FFB20F]">
                    <SelectValue placeholder="Select user role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="b2b_user">B2B User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center space-x-4">
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="w-4 h-4 text-[#FFB20F] border-gray-300 rounded focus:ring-[#FFB20F]"
                  />
                </FormControl>
                <FormLabel className="text-[#6E6F71] text-sm font-medium">
                  Active Account
                </FormLabel>
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="border-gray-300 text-[#6E6F71] hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
          >
            {isSubmitting ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>{user ? "Updating..." : "Creating..."}</span>
              </div>
            ) : (
              user ? "Update User" : "Create User"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}