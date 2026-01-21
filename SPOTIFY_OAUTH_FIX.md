# Spotify OAuth Fix - Mobile & PWA Support

## Problem Summary
Spotify OAuth was failing on mobile devices and PWA installations because:
- Mobile browsers don't properly maintain `window.opener` references for popups
- PWA standalone mode treats popups differently than desktop browsers
- The OAuth callback relied solely on `postMessage` to `window.opener`, which was `null` on mobile
- This caused an infinite loop where users would authorize but never receive the refresh token

## Solution Implemented

### 1. **New Hook: `useSpotifyOAuth`** (`src/hooks/useSpotifyOAuth.ts`)
- **Mobile Detection**: Automatically detects mobile devices and PWA standalone mode
- **Dual Flow Support**: 
  - Desktop: Uses popup window with `postMessage`
  - Mobile/PWA: Uses full-page redirect flow
- **State Management**: Generates CSRF protection tokens and manages OAuth state
- **Error Handling**: Comprehensive error handling with clear user feedback

### 2. **Updated App.tsx** (`src/App.tsx`)
- **URL Parameter Detection**: Listens for `?code=` and `?error=` query parameters on page load
- **Automatic Token Exchange**: When OAuth redirect returns with code, automatically exchanges it for refresh token
- **Clean URL**: Removes OAuth parameters from URL after processing
- **localStorage Tracking**: Uses `spotify-oauth-redirect` flag to detect pending OAuth flows

### 3. **Updated SettingsModal** (`src/components/SettingsModal.tsx`)
- **Integrated Hook**: Uses `useSpotifyOAuth` hook for simplified OAuth management
- **Dual Flow Support**: Supports both popup (desktop) and redirect (mobile) flows
- **Improved Error Display**: Shows errors from both local state and hook
- **Auto-sync**: Automatically updates local state when refresh token is received

### 4. **Updated Backend Callback** (`api/src/index.js`)
- **Smart Flow Detection**: Detects whether `window.opener` exists
- **Popup Flow**: If opener exists, uses `postMessage` (desktop)
- **Redirect Flow**: If no opener, redirects back to main app with code in URL (mobile/PWA)
- **Improved UI**: Better loading states and mobile-friendly design

## Technical Details

### Flow Diagrams

#### Desktop (Popup Flow)
```
1. User clicks "Connect" in Settings
2. useSpotifyOAuth detects desktop → opens popup
3. User authorizes on Spotify
4. Spotify redirects to /api/ml/spotify/callback
5. Callback page detects window.opener exists
6. Sends postMessage to parent window with code
7. SettingsModal receives message, calls handleOAuthCallback
8. Code is exchanged for refresh token
9. Popup closes automatically
```

#### Mobile/PWA (Redirect Flow)
```
1. User clicks "Connect" in Settings
2. useSpotifyOAuth detects mobile/PWA → sets localStorage flag
3. Full-page redirect to Spotify authorization
4. User authorizes on Spotify
5. Spotify redirects to /api/ml/spotify/callback
6. Callback page detects no window.opener
7. Redirects to /?code=AUTH_CODE
8. App.tsx detects code in URL + localStorage flag
9. Automatically calls handleOAuthCallback
10. Code is exchanged for refresh token
11. URL cleaned up
```

### Security Features
- **CSRF Protection**: State parameter generated and validated
- **Secure Token Storage**: Refresh tokens stored in localStorage and synced to database
- **Error Isolation**: OAuth errors don't crash the app

## Files Changed
1. ✅ `src/hooks/useSpotifyOAuth.ts` (NEW)
2. ✅ `src/App.tsx` (MODIFIED)
3. ✅ `src/components/SettingsModal.tsx` (MODIFIED)
4. ✅ `api/src/index.js` (MODIFIED)

## Testing Instructions

### Desktop Testing
1. Open app in Chrome/Firefox desktop
2. Go to Settings (gear icon)
3. Scroll to Spotify section
4. Click "Connect" button
5. ✅ Popup should open with Spotify login
6. ✅ After authorizing, popup should close automatically
7. ✅ Refresh token should appear in settings (masked)
8. ✅ Test song playback - should get full songs, not 30-second previews

### Mobile Testing (Critical)
1. Open app on mobile browser (iOS Safari, Chrome Android)
2. Go to Settings
3. Scroll to Spotify section
4. Click "Connect" button
5. ✅ Should redirect (not popup) to Spotify authorization
6. ✅ After authorizing, should redirect back to main app
7. ✅ Refresh token should be automatically saved
8. ✅ Settings modal should show token (open settings again to verify)
9. ✅ Test song playback - should get full songs

### PWA Testing (Critical)
1. Install app as PWA (Add to Home Screen on iOS/Android)
2. Open PWA in standalone mode
3. Follow mobile testing steps above
4. ✅ OAuth should work seamlessly with redirect flow

## Expected Behavior

### Success Indicators
- ✅ Desktop: Popup opens and closes automatically
- ✅ Mobile: Page redirects and returns smoothly
- ✅ Refresh token appears in settings
- ✅ Full song playback works (not just 30-second previews)
- ✅ No infinite redirect loops
- ✅ No "Authorization Successful" screen that reloads

### Error Handling
- ❌ If popup blocked: Shows error message
- ❌ If user denies: Shows authorization failed message
- ❌ If network error: Shows token exchange failed message
- All errors are user-friendly and non-blocking

## Troubleshooting

### "Popup was blocked" error
- Browser is blocking popups
- On mobile, this is expected - the hook will fall back to redirect flow automatically

### OAuth redirect not working
- Check browser console for `[Spotify OAuth]` logs
- Verify `.env` has correct `VITE_SPOTIFY_CALLBACK_URL`
- Ensure Spotify app dashboard has callback URL configured: `https://mlstrat.mattmariani.com/api/ml/spotify/callback`

### Infinite redirect loop
- This should be fixed! If it still happens:
  - Clear localStorage: `localStorage.removeItem('spotify-oauth-redirect')`
  - Check browser console for errors

### Still getting 30-second previews
- Refresh token not saved properly
- Check Settings → Spotify section for refresh token
- Try reconnecting
- Check browser console for token refresh errors

## Deployment Notes

### Environment Variables Required
```bash
VITE_SPOTIFY_CLIENT_ID=your_client_id
VITE_SPOTIFY_CLIENT_SECRET=your_client_secret
VITE_SPOTIFY_CALLBACK_URL=https://mlstrat.mattmariani.com/api/ml/spotify/callback
```

### Spotify App Configuration
In your Spotify Developer Dashboard, ensure Redirect URI is set to:
```
https://mlstrat.mattmariani.com/api/ml/spotify/callback
```

## Technical Improvements Made

1. **Automatic Mobile Detection**: No user configuration needed
2. **Unified OAuth Logic**: Single source of truth in `useSpotifyOAuth` hook
3. **Better State Management**: Uses React hooks and localStorage appropriately
4. **CSRF Protection**: State parameter prevents OAuth hijacking
5. **Error Boundaries**: Errors don't crash the app
6. **Clean URLs**: OAuth parameters cleaned from URL after processing
7. **Better UX**: Loading states and clear error messages

## Future Enhancements (Optional)

- [ ] Add retry mechanism for failed token exchanges
- [ ] Implement token refresh on app resume (for PWA)
- [ ] Add analytics to track OAuth success rates
- [ ] Show "Connected as @username" after successful OAuth
- [ ] Add manual token paste option for advanced users

---

**Build Status**: ✅ Successfully compiled with no errors
**Ready for Deployment**: ✅ Yes
