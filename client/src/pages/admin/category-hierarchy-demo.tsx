import React from 'react';
import { CategoryHierarchyDemo } from '@/components/demo/CategoryHierarchyDemo';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Layers, Database, TreePine } from 'lucide-react';
import { Link } from 'wouter';

export default function CategoryHierarchyDemoPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">3-Level Category Hierarchy</h1>
              <p className="text-gray-600">Enterprise materialized paths implementation</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">
            Option 1: Self-Referencing + Materialized Paths
          </Badge>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Architecture</CardTitle>
              <Database className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">Self-Referencing</div>
              <p className="text-xs text-gray-600 mt-1">
                parent_id references categories.id for tree structure
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Performance</CardTitle>
              <Layers className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Materialized Paths</div>
              <p className="text-xs text-gray-600 mt-1">
                Pre-computed paths for fast queries and breadcrumbs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hierarchy Depth</CardTitle>
              <TreePine className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">3 Levels</div>
              <p className="text-xs text-gray-600 mt-1">
                Software → Business Apps → Office Suites
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Technical Implementation Details */}
        <Card>
          <CardHeader>
            <CardTitle>Technical Implementation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-3">Database Schema Enhancements</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <code className="bg-gray-100 px-2 py-1 rounded">parent_id</code>
                    <span className="text-gray-600">Self-reference for tree structure</span>
                  </div>
                  <div className="flex justify-between">
                    <code className="bg-gray-100 px-2 py-1 rounded">level</code>
                    <span className="text-gray-600">1, 2, or 3 (depth constraint)</span>
                  </div>
                  <div className="flex justify-between">
                    <code className="bg-gray-100 px-2 py-1 rounded">path</code>
                    <span className="text-gray-600">/software/business/office</span>
                  </div>
                  <div className="flex justify-between">
                    <code className="bg-gray-100 px-2 py-1 rounded">path_name</code>
                    <span className="text-gray-600">Human-readable breadcrumbs</span>
                  </div>
                  <div className="flex justify-between">
                    <code className="bg-gray-100 px-2 py-1 rounded">sort_order</code>
                    <span className="text-gray-600">Display order within level</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3">Performance Optimizations</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Composite indexes on parent_id, level, path</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Materialized path queries avoid recursive CTEs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Breadcrumb generation without JOIN operations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Fast subtree queries using path LIKE patterns</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interactive Demo */}
        <CategoryHierarchyDemo />

        {/* API Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle>Available API Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-3">Hierarchy Operations</h3>
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex">
                    <span className="text-green-600 w-12">GET</span>
                    <span>/api/categories/hierarchy</span>
                  </div>
                  <div className="flex">
                    <span className="text-green-600 w-12">GET</span>
                    <span>/api/categories/level/:level</span>
                  </div>
                  <div className="flex">
                    <span className="text-green-600 w-12">GET</span>
                    <span>/api/categories/:id/children</span>
                  </div>
                  <div className="flex">
                    <span className="text-green-600 w-12">GET</span>
                    <span>/api/categories/:id/path</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3">Management Operations</h3>
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex">
                    <span className="text-blue-600 w-12">POST</span>
                    <span>/api/categories/hierarchy</span>
                  </div>
                  <div className="flex">
                    <span className="text-yellow-600 w-12">PUT</span>
                    <span>/api/categories/:id</span>
                  </div>
                  <div className="flex">
                    <span className="text-red-600 w-12">DEL</span>
                    <span>/api/categories/:id</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}