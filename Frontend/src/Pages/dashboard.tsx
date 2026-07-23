import React, { useState, useEffect } from 'react';
import { UserRound, Trash2, FolderGit2, Search, Plus, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '../component/ui/card';
import { Button } from '../component/ui/Button';
import { Input } from '../component/ui/Input';
import { Alert, AlertDescription } from '../component/alert';


interface Project {
    id: string;
    name: string;
    users: string[];
    createdBy: string;
    version?: number;
    lastUpdated?: string;
}

const ProjectDashboard = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [projectName, setProjectName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAlert, setShowAlert] = useState(false);
    // const [selectedView, setSelectedView] = useState('grid');
    const [isLoading, setIsLoading] = useState(true);
    const [activeCard, setActiveCard] = useState<string | null>(null);

    // Simulate projects data
    const [projects, setProjects] = useState<Project[]>([
        {
            id: '1',
            name: 'Design System',
            users: ['user1', 'user2', 'user3'],
            createdBy: 'user1',
            version: 2.0,
            lastUpdated: '2024-02-19'
        },
        {
            id: '2',
            name: 'Mobile App',
            users: ['user1', 'user4'],
            createdBy: 'user2',
            version: 1.5,
            lastUpdated: '2024-02-18'
        }
    ]);

    // Simulating logged in user
    const user = { id: 'user1' };

    useEffect(() => {
        setTimeout(() => setIsLoading(false), 1500);
    }, []);

    const handleCreateProject = (e: React.FormEvent) => {
        e.preventDefault();
        const newProject = {
            id: Math.random().toString(),
            name: projectName,
            users: [user.id],
            createdBy: user.id,
            version: 1.0,
            lastUpdated: new Date().toISOString().split('T')[0]
        };
        setProjects([...projects, newProject]);
        setProjectName('');
        setIsModalOpen(false);
        setShowAlert(true);
        setTimeout(() => setShowAlert(false), 3000);
    };

    const filteredProjects = projects.filter(project =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isProjectCreator = (project: Project) => project.createdBy === user.id;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-8" >
            {/* Floating Action Button */}
            < Button
                onClick={() => setIsModalOpen(true)}
                className="fixed bottom-8 right-8 w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
            >
                <Plus size={24} />
            </Button>

            {/* Success Alert */}
            {
                showAlert && (
                    <div className="fixed top-4 right-4 z-50" >
                        <Alert className="bg-green-50 border-green-200 text-green-800 animate-slide-in-right shadow-lg" >
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertDescription>Project created successfully! </AlertDescription>
                        </Alert>
                    </div>
                )
            }

            <div className="max-w-7xl mx-auto" >
                {/* Header Section */}
                < div className="mb-12 text-center" >
                    <h1 className="text-4xl font-bold text-slate-800 mb-4 animate-fade-in" >
                        Project Dashboard
                    </h1>
                    < div className="relative max-w-xl mx-auto" >
                        <Input
                            type="search"
                            placeholder="Search projects..."
                            className="w-full pl-12 h-12 shadow-sm"
                            value={searchQuery}
                            onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setSearchQuery(e.target.value)}
                        />
                        < Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    </div>
                </div>

                {/* Projects Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" >
                    {
                        isLoading ? (
                            // Skeleton Loading
                            Array.from({ length: 6 }).map((_, index) => (
                                <Card key={index} className="animate-pulse" >
                                    <CardContent className="p-6" >
                                        <div className="h-6 bg-slate-200 rounded w-3/4 mb-4" > </div>
                                        < div className="h-4 bg-slate-200 rounded w-1/2" > </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            filteredProjects.map((project) => (
                                <Card
                                    key={project.id}
                                    className={`group transition-all duration-500 hover:shadow-2xl 
                                    ${activeCard === project.id ? 'scale-105' : 'hover:scale-102'}
                                    transform perspective-1000`}
                                    onMouseEnter={() => setActiveCard(project.id)}
                                    onMouseLeave={() => setActiveCard(null)}
                                >
                                    <CardContent className="p-6 relative overflow-hidden" >
                                        {/* Background Pattern */}
                                        < div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500" > </div>

                                        < div className="relative" >
                                            <div className="flex justify-between items-start mb-4" >
                                                <div className="flex items-center gap-3" >
                                                    <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg group-hover:shadow-xl transition-all duration-300" >
                                                        <FolderGit2 className="text-white" size={24} />
                                                    </div>
                                                    < div >
                                                        <h2 className="text-xl font-semibold text-slate-800" >
                                                            {project.name}
                                                        </h2>
                                                        < p className="text-sm text-slate-500" >
                                                            Last updated: {project.lastUpdated}
                                                        </p>
                                                    </div>
                                                </div>
                                                {isProjectCreator(project) && (
                                                    <Button
                                                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50 transition-all duration-300"
                                                        onClick={() => {
                                                            setProjectToDelete(project);
                                                            setIsDeleteModalOpen(true);
                                                        }}
                                                    >
                                                        <Trash2 size={18} />
                                                    </Button>
                                                )}
                                            </div>

                                            < div className="flex flex-wrap gap-3 mt-4" >
                                                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full text-blue-700 text-sm" >
                                                    <UserRound size={14} />
                                                    {project.users.length} Members
                                                </div>
                                                {
                                                    project.version && (
                                                        <div className="bg-purple-50 px-3 py-1.5 rounded-full text-purple-700 text-sm">
                                                            v{project.version}
                                                        </div>
                                                    )}
                                                {
                                                    isProjectCreator(project) && (
                                                        <div className="bg-green-50 px-3 py-1.5 rounded-full text-green-700 text-sm" >
                                                            Owner
                                                        </div>
                                                    )
                                                }
                                            </div>

                                            < div className="mt-6 flex justify-end" >
                                                <Button
                                                    className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg transition-all duration-300"
                                                >
                                                    Open Project
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                </div>

                {/* Create Project Modal */}
                {
                    isModalOpen && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in" >
                            <Card className="w-96 p-6 transform transition-all duration-300 animate-scale-up" >
                                <div className="flex justify-between items-center mb-6" >
                                    <h2 className="text-2xl font-bold" > Create New Project </h2>
                                    < Button

                                        onClick={() => setIsModalOpen(false)
                                        }
                                    >
                                        <X size={18} />
                                    </Button>
                                </div>
                                < form onSubmit={handleCreateProject} >
                                    <div className="mb-6" >
                                        <label className="block text-sm font-medium mb-2" >
                                            Project Name
                                        </label>
                                        < Input
                                            value={projectName}
                                            onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setProjectName(e.target.value)}
                                            className="w-full h-12"
                                            placeholder="Enter project name"
                                            required
                                        />
                                    </div>
                                    < div className="flex justify-end gap-3" >
                                        <Button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="w-28"
                                        >
                                            Cancel
                                        </Button>
                                        < Button
                                            type="submit"
                                            className="w-28 bg-gradient-to-r from-blue-500 to-blue-600"
                                        >
                                            Create
                                        </Button>
                                    </div>
                                </form>
                            </Card>
                        </div>
                    )}

                {/* Delete Confirmation Modal */}
                {
                    isDeleteModalOpen && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in" >
                            <Card className="w-96 p-6 transform transition-all duration-300 animate-scale-up" >
                                <div className="flex items-center gap-4 mb-6" >
                                    <div className="p-3 bg-red-50 rounded-full" >
                                        <AlertCircle className="text-red-500" size={24} />
                                    </div>
                                    < div >
                                        <h2 className="text-2xl font-bold" > Delete Project </h2>
                                        < p className="text-slate-500" > This action cannot be undone </p>
                                    </div>
                                </div>
                                < p className="mb-6 text-slate-600" >
                                    Are you sure you want to delete "{projectToDelete?.name}" ?
                                </p>
                                < div className="flex justify-end gap-3" >
                                    <Button
                                        onClick={() => {
                                            setIsDeleteModalOpen(false);
                                            setProjectToDelete(null);
                                        }
                                        }
                                        className="w-28"
                                    >
                                        Cancel
                                    </Button>
                                    < Button

                                        onClick={() => {
                                            setProjects(projects.filter(p => p.id !== projectToDelete?.id));
                                            setIsDeleteModalOpen(false);
                                            setProjectToDelete(null);
                                        }}
                                        className="w-28 bg-gradient-to-r from-red-500 to-red-600"
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    )}
            </div>

            <style>{`
                @keyframes slide-in-right {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scale-up {
                    from {
                        transform: scale(0.95);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.3s ease-out;
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out;
                }
                .animate-scale-up {
                    animation: scale-up 0.3s ease-out;
                }
                .scale-102 {
                    transform: scale(1.02);
                }
            `}</style>
        </div>
    );
};

export default ProjectDashboard;

