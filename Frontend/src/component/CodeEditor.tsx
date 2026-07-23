import React, { useRef, useEffect } from 'react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { WebContainer, WebContainerProcess } from '@webcontainer/api';
import axios from '../config/axios'
import { receiveMessage, sendMessage } from '../config/socket';

interface FileTree {
    [key: string]: {
        file: {
            contents: string;
            language: string;
        }
    };
}

interface CodeEditorProps {
    fileTree: FileTree;
    setFileTree: React.Dispatch<React.SetStateAction<FileTree>>;
    currentFile: string | null;
    setCurrentFile: React.Dispatch<React.SetStateAction<string | null>>;
    openFiles: string[];
    setOpenFiles: React.Dispatch<React.SetStateAction<string[]>>;
    webContainer: WebContainer | null;
    iframeUrl: string | null;
    setIframeUrl: React.Dispatch<React.SetStateAction<string | null>>;
    runProcess: WebContainerProcess | null;
    setRunProcess: React.Dispatch<React.SetStateAction<WebContainerProcess | null>>;
    project: { id: string };
}

const CodeEditor: React.FC<CodeEditorProps> = ({
    currentFile,
    setCurrentFile,
    fileTree,
    setFileTree,
    openFiles,
    setOpenFiles,
    webContainer,
    iframeUrl,
    setIframeUrl,
    runProcess,
    setRunProcess,
    project
}) => {
    const codeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!currentFile || !codeRef.current) return;

        const fileData = fileTree[currentFile].file;
        if (!fileData || !fileData.contents) {
            codeRef.current.innerHTML = `<span style="color: gray;">No content available</span>`;
            return;
        }

        const { contents, language } = fileData;
        const highlighted = language ? hljs.highlight(contents, { language }).value : hljs.highlightAuto(contents).value;

        codeRef.current.innerHTML = highlighted;
    }, [currentFile, fileTree]);

    useEffect(() => {
        receiveMessage("project-code", (data: any) => {
            console.log(data)
            setFileTree(data);
        });

    }, [])

    // Handle input changes in the contentEditable div
    const handleInput = (e: React.FocusEvent<HTMLDivElement>) => {
        if (!currentFile) return;
        const newContent = e.currentTarget.innerText;
        const currentFileData = fileTree[currentFile].file;
        const ft = {
            ...fileTree,
            [currentFile]: {
                file: {
                    contents: newContent,
                    language: currentFileData.language, // Ensure language is included
                }
            }
        };

        setFileTree(ft);

        saveFileTree(ft)

        sendMessage("project-code", ft);
    };

    // Handle tab insertion manually
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Tab") {
            e.preventDefault();
            document.execCommand("insertText", false, "\t");
        }
    };

    // Handle file selection
    const handleFileClick = (file: string) => {
        setCurrentFile(file);
        if (!openFiles.includes(file)) {
            setOpenFiles((prev) => [...prev, file]);
        }
    };

    // Handle closing a file tab
    const handleFileClose = (file: string) => {
        const updatedOpenFiles = openFiles.filter((openFile) => openFile !== file);
        setOpenFiles(updatedOpenFiles);
        if (currentFile === file) {
            setCurrentFile(updatedOpenFiles.length > 0 ? updatedOpenFiles[0] : null);
        }
    };

    const saveFileTree = (ft: FileTree) => {
        console.log("first")
        axios.put('/project/update-file-tree', {
            projectId: project.id,
            fileTree: ft,
        }).then((res) => {
            console.log(res)
        }).catch((err) => {
            console.log(err)
        })

    }

    const truncateFilename = (filename: string, maxLength: number = 20) => {
        if (filename.length <= maxLength) return filename;
        const extension = filename.lastIndexOf('.') > 0 ?
            filename.substring(filename.lastIndexOf('.')) : '';
        const name = filename.substring(0, filename.lastIndexOf('.') > 0 ?
            filename.lastIndexOf('.') : filename.length);

        if (name.length <= maxLength - 3 - extension.length) return filename;

        return `${name.substring(0, maxLength - 3 - extension.length)}...${extension}`;
    };

    return (
        <>

            <div className="code-editor flex flex-col w-full h-full">
                <div className="code-editor-header flex gap-1 items-center justify-between w-full bg-gray-200 p-2">
                    <div className="files flex">
                        {openFiles.map((file, index) => (
                            <button
                                title={file}
                                key={index}
                                onClick={() => handleFileClick(file)}
                                className={`flex items-center gap-2 cursor-pointer border rounded-sm px-2 py-1 ${currentFile === file ? 'bg-blue-600 text-white' : 'bg-gray-300'
                                    } hover:bg-gray-400`}
                            >
                                {/* <span className="font-semibold">{file}</span> */}
                                <p className="font-semibold">{truncateFilename(file)}</p>
                                <i
                                    className="ri-close-fill"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleFileClose(file);
                                    }}
                                ></i>
                            </button>
                        ))}
                    </div>
                    <div className="action">
                        <button
                            onClick={async () => {
                                if (webContainer) {

                                    await webContainer.mount(fileTree);

                                    const installProcess = await webContainer.spawn('npm', ['install']);

                                    installProcess.output.pipeTo(new WritableStream({
                                        write(chunk) {
                                            console.log(chunk.toString());
                                        },
                                    }))

                                    await webContainer.spawn('npx', ['kill-port', '3000'])

                                    if (runProcess) {
                                        runProcess.kill()
                                    }

                                    let tempRunProcess = await webContainer.spawn('npm', ['start']);

                                    tempRunProcess.output.pipeTo(new WritableStream({
                                        write(chunk) {
                                            console.log(chunk.toString());
                                        },
                                    }))

                                    setRunProcess(tempRunProcess);

                                    webContainer.on('server-ready', (port, url) => {
                                        console.log(port, url);
                                        setIframeUrl(url);

                                    })
                                    // const process = await webContainer.spawn('ls');
                                    // await webContainer?.mount(fileTree)
                                    // process.output.pipeTo(new WritableStream({
                                    //     async write(chunk) {
                                    //         console.log(chunk);
                                    //     }
                                    // }));
                                }
                            }}
                            className='p-2 px-4 bg-slate-300 text-white'>
                            ls
                        </button>
                    </div>
                </div>

                <div className="bg-gray-950 w-full h-full text-green-400 overflow-auto p-4 font-mono text-lg">
                    <div className="h-full overflow-hidden flex-grow bg-gray-900 rounded-md border border-gray-700">
                        <pre className="hljs h-full m-0 p-4">
                            <code
                                ref={codeRef}
                                className="hljs h-full pt-4 outline-none"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={handleInput}
                                onKeyDown={handleKeyDown}
                                dangerouslySetInnerHTML={{
                                    __html: currentFile ? hljs.highlightAuto(fileTree[currentFile]?.file?.contents || "").value : "",
                                }}
                                style={{
                                    fontSize: "1rem",
                                    lineHeight: "1.6",
                                    whiteSpace: "pre-wrap",
                                    paddingBottom: "25rem",
                                }}
                            />
                        </pre>
                    </div>
                </div>

            </div>

            {
                iframeUrl && webContainer &&
                (
                    <div className="flex flex-col h-full min-w-96">
                        <div className="address-bar">
                            <input type="text"
                                onChange={(e) => setIframeUrl(e.target.value)}
                                value={iframeUrl}
                                className="w-full h-10 px-4 p-2 text-lg text-gray-400 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        < iframe src={iframeUrl} className="w-full h-full" />
                    </div>
                )
            }

        </>
    );
};

export default CodeEditor;
