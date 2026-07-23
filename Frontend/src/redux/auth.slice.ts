import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

interface User {
    id: string;
    email: string;
}

interface UserState {
    user: User | null;
    isAuthenticated: boolean;
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

const initialState: UserState = {
    user: null,
    isAuthenticated: false,
    status: 'idle',
    error: null,
};

// Async thunk to validate JWT
export const validateToken = createAsyncThunk('/user/validateToken', async (_, { rejectWithValue }) => {
    try {
        const response = await axios.get<{ user: User }>(`${import.meta.env.VITE_API_URL}/users/profile`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
        });
        console.log(response.data)
        return response.data;
    }
    catch (error: any) {
        return rejectWithValue(error.response?.data?.message || 'Sign in failed. Please try again.');
    }

});

const userSlice = createSlice({
    name: 'user',
    initialState: initialState,
    reducers: {
        logout: (state) => {
            state.user = null;
            state.isAuthenticated = false;
            localStorage.removeItem('token');
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(validateToken.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(validateToken.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.user = action.payload.user;
                console.log(action.payload)
                state.isAuthenticated = true;
                console.log(state.isAuthenticated)
            })
            .addCase(validateToken.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload as string;
                state.isAuthenticated = false;
                localStorage.removeItem('token');
            });
    },
});

export const { logout } = userSlice.actions;
export default userSlice.reducer;
