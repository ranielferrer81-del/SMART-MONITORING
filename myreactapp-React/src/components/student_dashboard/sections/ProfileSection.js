import React from 'react';

const ProfileSection = ({ studentInfo, profilePictureUrl, profileFields, uploadingPicture, fileInputRef, handleFileSelection, handleDeleteProfilePicture }) => {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white/40 backdrop-blur-md shadow-2xl rounded-2xl border border-white/20 dark:bg-slate-900/40 dark:border-white/10 overflow-hidden">
                <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
                    {!studentInfo ? (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 bg-slate-100/10 backdrop-blur-sm dark:bg-slate-800/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 font-medium">No student information found.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col md:flex-row gap-6 md:items-center pb-6 border-b border-slate-200 dark:border-slate-800">
                                <div className="relative w-24 h-24 flex-shrink-0">
                                    {profilePictureUrl ? (
                                        <img src={profilePictureUrl} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-rose-200 dark:border-rose-800 shadow-lg" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                                    ) : (
                                        <div className="w-24 h-24 bg-gradient-to-br from-rose-500 to-red-600 rounded-full flex items-center justify-center shadow-lg text-white">
                                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        </div>
                                    )}
                                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPicture} className="absolute -bottom-2 -right-2 w-9 h-9 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" title="Change profile picture">
                                        {uploadingPicture ? (
                                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        )}
                                    </button>
                                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" className="hidden" onChange={handleFileSelection} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">{studentInfo.name || 'Student'}</h3>
                                    <p className="text-sm text-slate-700 dark:text-slate-200 font-medium mt-1">{studentInfo.sectionCourse || 'No course information yet.'}</p>
                                    <div className="flex flex-wrap gap-3 mt-4">
                                        <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium shadow hover:bg-rose-700 transition-colors">Change Photo</button>
                                        <button onClick={handleDeleteProfilePicture} disabled={uploadingPicture || !studentInfo.profilePicture} className="px-4 py-2 rounded-lg border border-slate-200/80 text-sm font-medium text-slate-800 dark:text-slate-100 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed">Remove Photo</button>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {profileFields.map((field) => (
                                    <div key={field.label} className="p-4 rounded-xl bg-slate-50/10 backdrop-blur-sm dark:bg-slate-800/10 border border-slate-200/60 dark:border-slate-800/60 shadow-inner">
                                        <p className="text-xs uppercase tracking-widest text-slate-400">{field.label}</p>
                                        <p className="text-lg font-semibold text-slate-900 dark:text-white mt-2">{field.value || 'Not set'}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfileSection;
