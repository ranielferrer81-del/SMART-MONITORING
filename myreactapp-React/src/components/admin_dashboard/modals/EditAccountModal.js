import React from 'react';

const EditAccountModal = ({ editUser, setEditUser, saveEdit, loading }) => {
    if (!editUser) return null;

    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 transition-opacity duration-300" onClick={() => setEditUser(null)}>
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 dark:bg-slate-900 dark:border dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Edit Account</h3>
                        <p className="text-sm text-slate-600 mt-1 dark:text-slate-400">
                            {editUser.role === 'student' ? `Student Account - ${editUser.course || 'No Course'}` : editUser.role === 'teacher' ? 'Professor Account' : 'Admin Account'}
                        </p>
                    </div>
                    <button onClick={() => setEditUser(null)} className="text-slate-400 hover:text-slate-600 transition-colors duration-300 p-2 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Full Name <span className="text-red-500">*</span></label>
                            <input type="text" value={editUser.full_name || ''} onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })} className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Email <span className="text-red-500">*</span></label>
                            <input type="email" value={editUser.email || ''} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Account Status</label>
                            <div className="flex items-center space-x-4">
                                <label className="flex items-center"><input type="radio" name="is_active" checked={editUser.is_active === true} onChange={() => setEditUser({ ...editUser, is_active: true })} className="h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300 dark:bg-slate-800" /><span className="ml-2 text-sm text-gray-700 dark:text-slate-300">Active</span></label>
                                <label className="flex items-center"><input type="radio" name="is_active" checked={editUser.is_active === false} onChange={() => setEditUser({ ...editUser, is_active: false })} className="h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300 dark:bg-slate-800" /><span className="ml-2 text-sm text-gray-700 dark:text-slate-300">Inactive</span></label>
                            </div>
                        </div>
                        {(editUser.role === 'student' || editUser.course || editUser.student_number) && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Course <span className="text-red-500">*</span></label>
                                        <select value={editUser.course || ''} onChange={(e) => setEditUser({ ...editUser, course: e.target.value })} className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100" required>
                                            <option value="">Select course</option><option value="BSIT">BSIT</option><option value="BSCS">BSCS</option><option value="BSEMC">BSEMC</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Section <span className="text-red-500">*</span></label>
                                        <input type="text" value={editUser.section || ''} onChange={(e) => setEditUser({ ...editUser, section: e.target.value })} className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100" placeholder="Enter section (e.g., 3-Y1-1)" required />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Student Number</label>
                                    <input type="text" value={editUser.student_number || ''} onChange={(e) => setEditUser({ ...editUser, student_number: e.target.value })} className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100" placeholder="Enter student number" />
                                </div>
                            </>
                        )}
                        {editUser.role === 'teacher' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Department</label>
                                    <input type="text" value={editUser.department || ''} onChange={(e) => setEditUser({ ...editUser, department: e.target.value })} className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100" placeholder="Enter department" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Specialization</label>
                                    <input type="text" value={editUser.specialization || ''} onChange={(e) => setEditUser({ ...editUser, specialization: e.target.value })} className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100" placeholder="Enter specialization" />
                                </div>
                            </>
                        )}
                        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-slate-800">
                            <button type="button" onClick={() => setEditUser(null)} className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancel</button>
                            <button type="submit" disabled={loading} className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors ${loading ? 'bg-rose-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700'}`}>{loading ? 'Saving...' : 'Save Changes'}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditAccountModal;
