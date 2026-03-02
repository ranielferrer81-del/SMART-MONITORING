import React from 'react';
import { forceCloseStudentBrowser } from '../../../api/browserMonitoring';

const BrowserActivityModal = ({
    activityModalOpen,
    currentViewStudent,
    studentActivity,
    setActivityModalOpen,
    setStudentActivity,
}) => {
    if (!activityModalOpen || !currentViewStudent) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm pt-8 sm:pt-32">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:justify-between sm:items-center bg-slate-50 dark:bg-slate-900/50 gap-4 sm:gap-0">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-50">
                        Browser Activity for {currentViewStudent.full_name}
                    </h3>
                    <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                        <button
                            onClick={async () => {
                                if (!window.confirm(`Are you sure you want to close ${currentViewStudent.full_name}'s browser and delete ALL their browsing history?\n\nThis will:\n- Close their entire browser\n- Delete all browsing history from the system\n- Free up database space`)) {
                                    return;
                                }
                                try {
                                    const result = await forceCloseStudentBrowser(currentViewStudent.id);
                                    if (result.ok) {
                                        // Clear the activity list from UI
                                        setStudentActivity([]);
                                        const deletedCount = result.data?.deleted_count || 0;
                                        alert(`Success!\n\n- ${deletedCount} history records deleted\n- Browser will close within 30 seconds`);
                                    } else {
                                        alert('Failed to send exit command: ' + (result.error || 'Unknown error'));
                                    }
                                } catch (error) {
                                    alert('Error sending exit command: ' + error.message);
                                }
                            }}
                            className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Exit Browser</span>
                        </button>
                        <button
                            onClick={() => setActivityModalOpen(false)}
                            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Close"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-0 w-full">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full min-w-[800px]">
                            <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 text-center sticky left-0 bg-slate-50 dark:bg-slate-900 z-10">Actions</th>
                                    <th className="px-6 py-3 text-left">Time</th>
                                    <th className="px-6 py-3 text-left">URL</th>
                                    <th className="px-6 py-3 text-left">Title</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {studentActivity.length > 0 ? (
                                    studentActivity.map((log) => (
                                        <tr key={log.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${log.is_incognito ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                                            <td className="px-6 py-4 text-center sticky left-0 bg-white dark:bg-slate-800 z-10 border-r border-slate-200 dark:border-slate-700">
                                                <button
                                                    onClick={async () => {
                                                        if (!window.confirm(`Close this tab for ${currentViewStudent.full_name}?\n\nURL: ${log.url}\n\nThe tab will close within 5 seconds.`)) {
                                                            return;
                                                        }
                                                        try {
                                                            const { forceCloseStudentTab } = await import('../../../api/browserMonitoring');
                                                            const result = await forceCloseStudentTab(currentViewStudent.id, log.id, log.url);
                                                            if (result.ok) {
                                                                // Remove from UI immediately for better UX
                                                                setStudentActivity(prev => prev.filter(item => item.id !== log.id));
                                                                alert('Tab close command sent! The tab will close within 5 seconds.');
                                                            } else {
                                                                alert('Failed to close tab: ' + (result.error || 'Unknown error'));
                                                            }
                                                        } catch (error) {
                                                            alert('Error closing tab: ' + error.message);
                                                        }
                                                    }}
                                                    className="inline-flex items-center px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-all duration-200 shadow hover:shadow-md transform hover:scale-105"
                                                    title="Close this tab on student's browser"
                                                >
                                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                    Close
                                                </button>
                                            </td>
                                            <td className="px-4 sm:px-6 py-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                {new Date(log.visit_timestamp).toLocaleTimeString()}
                                                {log.is_incognito && (
                                                    <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 rounded text-xs font-semibold">
                                                        Incognito
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 sm:px-6 py-4 text-sm font-mono break-all whitespace-normal max-w-xs sm:max-w-md xl:max-w-xl" title={log.url}>
                                                <a
                                                    href={log.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-rose-600 hover:text-rose-700 hover:underline dark:text-rose-400 dark:hover:text-rose-300"
                                                >
                                                    {log.url}
                                                </a>
                                            </td>
                                            <td className="px-4 sm:px-6 py-4 text-sm text-slate-600 dark:text-slate-400 break-words whitespace-normal max-w-xs sm:max-w-sm">
                                                {log.page_title || 'Untitled'}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                            No browsing history recorded
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrowserActivityModal;
