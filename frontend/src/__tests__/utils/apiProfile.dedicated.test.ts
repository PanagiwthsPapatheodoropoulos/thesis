import { getProfileImageUrl } from '../../utils/api';

describe('getProfileImageUrl', () => {
  it('returns null if baseUrl is null or empty', () => {
    expect(getProfileImageUrl(null)).toBeNull();
    expect(getProfileImageUrl('')).toBeNull();
  });

  it('returns the raw Base64 data string without appending version parameters', () => {
    const base64Url = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGB...';
    const result = getProfileImageUrl(base64Url);
    expect(result).toBe(base64Url);
    expect(result).not.toContain('?v=');
  });

  it('appends version parameter to standard http URLs to bypass cache', () => {
    const httpUrl = 'http://localhost:8080/api/employees/123/profile-image';
    const result = getProfileImageUrl(httpUrl);
    expect(result).toContain(httpUrl);
    expect(result).toMatch(/\?v=\d+/);
  });

  it('appends version parameter to relative URLs', () => {
    const relativeUrl = '/api/employees/123/profile-image';
    const result = getProfileImageUrl(relativeUrl);
    expect(result).toContain(relativeUrl);
    expect(result).toMatch(/\?v=\d+/);
  });
});
