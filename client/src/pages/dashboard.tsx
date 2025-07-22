import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Users, 
  UserCheck, 
  UserX, 
  Search,
  Filter,
  RefreshCw,
  Database,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface Driver {
  id: number;
  name: string;
  email?: string;
  phone: string;
  is_phone_verified: number;
  is_active: number;
  created_at: string;
  updated_at?: string;
}

interface DriversResponse {
  drivers: Driver[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface SystemStats {
  health: {
    status: string;
    database: boolean;
    connections?: any;
  };
  drivers: {
    total_drivers: number;
    active_drivers: number;
    verified_drivers: number;
  };
  timestamp: string;
}

// API helper functions
const apiRequest = async (endpoint: string, options?: RequestInit) => {
  const response = await fetch(`/api${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
};

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Fetch system statistics
  const { data: stats, isLoading: statsLoading } = useQuery<SystemStats>({
    queryKey: ['/api/stats'],
    queryFn: () => apiRequest('/stats'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch drivers
  const { data: driversData, isLoading: driversLoading, refetch: refetchDrivers } = useQuery<DriversResponse>({
    queryKey: ['/api/drivers', { search: searchTerm, is_active: activeFilter === 'all' ? null : activeFilter === 'active' ? 1 : 0 }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (activeFilter !== 'all') params.append('is_active', activeFilter === 'active' ? '1' : '0');
      return apiRequest(`/drivers?${params.toString()}`);
    },
  });

  // Create driver mutation
  const createDriverMutation = useMutation({
    mutationFn: (driverData: Partial<Driver>) => apiRequest('/drivers', {
      method: 'POST',
      body: JSON.stringify(driverData),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Driver created successfully",
        description: "The new driver has been added to the system.",
      });
      setIsCreateModalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create driver",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Deactivate driver mutation
  const deactivateDriverMutation = useMutation({
    mutationFn: (driverId: number) => apiRequest(`/drivers/${driverId}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Driver deactivated",
        description: "The driver has been deactivated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to deactivate driver",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateDriver = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    const driverData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      password: formData.get('password') as string,
      is_active: 1,
      is_phone_verified: 0,
    };

    createDriverMutation.mutate(driverData);
  };

  const handleDeactivateDriver = (driver: Driver) => {
    if (window.confirm(`Are you sure you want to deactivate ${driver.name}?`)) {
      deactivateDriverMutation.mutate(driver.id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Driver Log Pro Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage drivers and monitor system performance</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              onClick={() => refetchDrivers()}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Driver
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? '-' : stats?.drivers?.total_drivers || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Registered in system
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statsLoading ? '-' : stats?.drivers?.active_drivers || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Currently active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified Drivers</CardTitle>
              <UserCheck className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {statsLoading ? '-' : stats?.drivers?.verified_drivers || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Phone verified
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Database Status</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? (
                  <Activity className="h-5 w-5 animate-spin" />
                ) : (
                  <Badge variant={stats?.health?.database ? "default" : "destructive"}>
                    {stats?.health?.database ? "Connected" : "Disconnected"}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                System health
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Drivers Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Driver Management</CardTitle>
                <CardDescription>
                  View and manage all registered drivers
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Search drivers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
                <div className="flex bg-gray-100 rounded-md p-1">
                  {(['all', 'active', 'inactive'] as const).map((filter) => (
                    <Button
                      key={filter}
                      variant={activeFilter === filter ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setActiveFilter(filter)}
                      className="capitalize"
                    >
                      {filter}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {driversLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 animate-spin" />
                  <span>Loading drivers...</span>
                </div>
              </div>
            ) : !driversData?.drivers?.length ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Users className="h-12 w-12 mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No drivers found</h3>
                <p className="text-sm text-center mb-4">
                  {searchTerm || activeFilter !== 'all' 
                    ? "Try adjusting your search or filters" 
                    : "Get started by adding your first driver"
                  }
                </p>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Driver
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {driversData.drivers.map((driver) => (
                  <div key={driver.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{driver.name}</h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>{driver.phone}</span>
                            {driver.email && <span>{driver.email}</span>}
                            <span>Added {formatDate(driver.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={driver.is_active ? "default" : "secondary"}>
                            {driver.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {driver.is_phone_verified ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                              Unverified
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      {driver.is_active ? (
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDeactivateDriver(driver)}
                          disabled={deactivateDriverMutation.isPending}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {driversData && driversData.pagination.total > 0 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-gray-500">
                  Showing {driversData.drivers.length} of {driversData.pagination.total} drivers
                </div>
                {driversData.pagination.hasMore && (
                  <Button variant="outline" size="sm">
                    Load More
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Driver Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-medium mb-4">Add New Driver</h3>
              <form onSubmit={handleCreateDriver} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <Input name="name" required placeholder="Enter driver name" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone *</label>
                  <Input name="phone" required placeholder="+1234567890" type="tel" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <Input name="email" placeholder="driver@example.com" type="email" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <Input name="password" placeholder="Enter password" type="password" />
                </div>
                <Separator />
                <div className="flex space-x-3 justify-end">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setIsCreateModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createDriverMutation.isPending}
                  >
                    {createDriverMutation.isPending ? "Creating..." : "Create Driver"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}