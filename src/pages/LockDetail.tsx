import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Database, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getLockModeInfo } from '@/lib/lockData';

export default function LockDetail() {
  const { lockName } = useParams<{ lockName: string }>();
  
  if (!lockName) {
    return <Navigate to="/404" replace />;
  }

  const decodedLockName = decodeURIComponent(lockName);
  const lockInfo = getLockModeInfo(decodedLockName);

  if (!lockInfo) {
    return <Navigate to="/404" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Analyzer
            </Button>
          </Link>
          
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">{lockInfo.name}</h1>
          </div>
          <p className="text-lg text-gray-600">{lockInfo.description}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Conflicting Locks
              </CardTitle>
              <CardDescription>
                This lock conflicts with the following lock modes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lockInfo.conflicts.length > 0 ? (
                <div className="space-y-2">
                  {lockInfo.conflicts.map((conflictingLock) => (
                    <Link
                      key={conflictingLock}
                      to={`/lock/${encodeURIComponent(conflictingLock)}`}
                      className="block"
                    >
                      <Badge
                        variant="destructive"
                        className="w-full justify-center py-2 hover:bg-red-600 transition-colors cursor-pointer"
                      >
                        {conflictingLock}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No conflicts with other locks</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-500" />
                SQL Statements
              </CardTitle>
              <CardDescription>
                Statements that acquire this lock mode
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lockInfo.statements.map((statement, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="w-full justify-center py-2 font-mono text-sm"
                  >
                    {statement}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Detailed Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 leading-relaxed">{lockInfo.details}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}