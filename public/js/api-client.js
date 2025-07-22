// API Client for Toastmasters Website
class ApiClient {
    constructor() {
        this.baseUrl = '/api';
        this.token = localStorage.getItem('authToken');
        this.user = null;
    }

    // Helper method for making authenticated requests
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Request failed');
            }

            return response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Authentication methods
    async login(username, password) {
        try {
            const response = await this.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: username, password })
            });

            this.token = response.token;
            this.user = response.user;
            localStorage.setItem('authToken', this.token);

            return {
                id: this.user.id,
                name: this.user.name,
                email: this.user.email,
                isAdmin: this.user.role === 'admin'
            };
        } catch (error) {
            throw error;
        }
    }

    async verifyToken() {
        if (!this.token) return null;

        try {
            const response = await this.request('/auth/verify');
            if (response.valid) {
                this.user = response.user;
                return {
                    id: this.user.id,
                    name: this.user.name,
                    email: this.user.email,
                    isAdmin: this.user.role === 'admin'
                };
            }
            return null;
        } catch (error) {
            this.logout();
            return null;
        }
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('authToken');
    }

    // Meeting methods - No auth required for viewing
    async getMeetings() {
        try {
            // Try to get meetings - will work even without auth now
            const response = await fetch(`${this.baseUrl}/meetings/index`);
            if (!response.ok) {
                console.error('Failed to fetch meetings');
                return [];
            }
            
            const meetings = await response.json();

            // Transform the data to match the expected format
            return meetings.map(meeting => {
                const [year, month, day] = meeting.date.split('-');
                const date = new Date(year, month - 1, day);
                const isFirstTuesday = Math.ceil(date.getDate() / 7) === 1;

                return {
                    id: meeting.id,
                    date: meeting.date,
                    type: isFirstTuesday ? 'in-person' : 'virtual',
                    location: isFirstTuesday ? 'Crystal City Community Center' : 'Zoom (link sent to members)',
                    theme: meeting.theme || '',
                    roles: {}, // Will be populated separately
                    speeches: [], // Will be populated separately
                    evaluators: [] // Will be populated separately
                };
            });
        } catch (error) {
            console.error('Failed to get meetings:', error);
            return [];
        }
    }

    async getMeetingDetails(meetingId) {
        try {
            // Get roles - no auth required
            const rolesResponse = await fetch(`${this.baseUrl}/meetings/roles?meetingId=${meetingId}`);
            const roles = rolesResponse.ok ? await rolesResponse.json() : [];
            const roleMap = {};
            roles.forEach(role => {
                const roleType = role.role_name.toLowerCase().replace(/\s+/g, '-');
                roleMap[roleType] = role.member_name;
            });

            // Get speeches - no auth required
            const speechesResponse = await fetch(`${this.baseUrl}/meetings/speeches?meetingId=${meetingId}`);
            const speeches = speechesResponse.ok ? await speechesResponse.json() : [];
            const speechList = speeches.map((speech, index) => ({
                slot_number: index,
                user_name: speech.speaker_name,
                title: speech.speech_title,
                project: speech.speech_project || 'TBD'
            }));

            // Get evaluators (from speeches data)
            const evaluatorList = speeches.map((speech, index) => ({
                slot_number: index,
                user_name: speech.evaluator_name
            })).filter(e => e.user_name);

            return { roles: roleMap, speeches: speechList, evaluators: evaluatorList };
        } catch (error) {
            console.error('Failed to get meeting details:', error);
            return { roles: {}, speeches: [], evaluators: [] };
        }
    }

    // Sign-up methods - Require auth
    async signUpForRole(meetingId, roleType) {
        const roleNames = {
            'toastmaster': 'Toastmaster of the Evening',
            'evaluator': 'General Evaluator',
            'ah-counter-grammarian': 'Ah-Counter/Grammarian',
            'timer': 'Timer',
            'topics': 'Table Topics Master'
        };

        return this.request('/meetings/roles', {
            method: 'POST',
            body: JSON.stringify({
                meetingId,
                roleName: roleNames[roleType] || roleType,
                memberId: this.user.id
            })
        });
    }

    async signUpForSpeech(meetingId, slotNumber, title, project) {
        return this.request('/meetings/speeches', {
            method: 'POST',
            body: JSON.stringify({
                meetingId,
                speakerId: this.user.id,
                speechTitle: title,
                speechProject: project
            })
        });
    }

    async signUpForEvaluator(meetingId, slotNumber) {
        // First get the speech at this slot
        const speeches = await fetch(`${this.baseUrl}/meetings/speeches?meetingId=${meetingId}`).then(r => r.json());
        const speech = speeches[slotNumber];

        if (speech) {
            return this.request('/meetings/evaluators', {
                method: 'PUT',
                body: JSON.stringify({
                    speechId: speech.id,
                    evaluatorId: this.user.id
                })
            });
        }
        throw new Error('No speech found for this evaluator slot');
    }

    // Remove assignments - Require auth
    async removeRole(meetingId, roleType) {
        const roleNames = {
            'toastmaster': 'Toastmaster of the Evening',
            'evaluator': 'General Evaluator',
            'ah-counter-grammarian': 'Ah-Counter/Grammarian',
            'timer': 'Timer',
            'topics': 'Table Topics Master'
        };

        return this.request('/meetings/roles', {
            method: 'DELETE',
            body: JSON.stringify({
                meetingId,
                roleType: roleNames[roleType] || roleType
            })
        });
    }

    async removeSpeech(meetingId, slotNumber) {
        return this.request('/meetings/speeches', {
            method: 'DELETE',
            body: JSON.stringify({
                meetingId,
                slotNumber
            })
        });
    }

    async removeEvaluator(meetingId, slotNumber) {
        return this.request('/meetings/evaluators', {
            method: 'DELETE',
            body: JSON.stringify({
                meetingId,
                slotNumber
            })
        });
    }

    // Member management - Require auth
    async getMembers() {
        return this.request('/members/index');
    }

    async addMember(userData) {
        return this.request('/members/index', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async removeMember(memberId) {
        return this.request(`/members/${memberId}`, {
            method: 'DELETE'
        });
    }

    async updateMemberPassword(memberId, newPassword) {
        return this.request(`/members/${memberId}`, {
            method: 'PUT',
            body: JSON.stringify({ password: newPassword })
        });
    }

    // Application management - Require auth
    async getApplications() {
        return this.request('/applications/index');
    }

    async submitApplication(applicationData) {
        return this.request('/applications/index', {
            method: 'POST',
            body: JSON.stringify(applicationData)
        });
    }

    async updateApplicationStatus(applicationId, status) {
        return this.request(`/applications/[id]?id=${applicationId}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
    }
}

// Create and export a single instance
window.apiClient = new ApiClient();

// Check for existing auth token on page load
window.addEventListener('DOMContentLoaded', async () => {
    if (window.apiClient.token) {
        const user = await window.apiClient.verifyToken();
        if (user) {
            window.currentUser = user;
            if (window.updateAuthDisplay) {
                window.updateAuthDisplay();
            }
        }
    }
});
