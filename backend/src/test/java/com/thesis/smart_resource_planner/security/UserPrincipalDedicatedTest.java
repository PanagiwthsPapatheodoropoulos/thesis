package com.thesis.smart_resource_planner.security;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("UserPrincipal Dedicated Tests")
class UserPrincipalDedicatedTest {

    @Test
    @DisplayName("Should successfully construct a UserPrincipal via factory")
    void testCreateFromUserEntity() {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();

        Company company = new Company();
        company.setId(companyId);
        company.setName("Acme Corp");

        User user = new User();
        user.setId(userId);
        user.setUsername("testuser");
        user.setEmail("test@example.com");
        user.setPasswordHash("hashedpassword");
        user.setRole(UserRole.ADMIN);
        user.setIsActive(true);
        user.setCompany(company);

        UserPrincipal principal = UserPrincipal.create(user);

        assertEquals(userId, principal.getId());
        assertEquals("testuser", principal.getUsername());
        assertEquals("test@example.com", principal.getEmail());
        assertEquals("hashedpassword", principal.getPassword());
        assertEquals(companyId, principal.getCompanyId());
        assertTrue(principal.isEnabled());

        Collection<? extends GrantedAuthority> authorities = principal.getAuthorities();
        assertEquals(1, authorities.size());
        assertEquals("ROLE_ADMIN", authorities.iterator().next().getAuthority());
    }

    @Test
    @DisplayName("Should handle null company in factory")
    void testCreateFromUserEntity_NullCompany() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("superadmin");
        user.setEmail("sa@example.com");
        user.setPasswordHash("sa_hash");
        user.setRole(UserRole.SUPER_ADMIN);
        user.setIsActive(true);
        user.setCompany(null);

        UserPrincipal principal = UserPrincipal.create(user);

        assertNull(principal.getCompanyId());
        assertEquals("ROLE_SUPER_ADMIN", principal.getAuthorities().iterator().next().getAuthority());
    }

    @Test
    @DisplayName("Should return correct standard user details status flags")
    void testStandardUserDetailsFlags() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("disableduser");
        user.setEmail("disabled@example.com");
        user.setPasswordHash("hash");
        user.setRole(UserRole.EMPLOYEE);
        user.setIsActive(false);

        UserPrincipal principal = UserPrincipal.create(user);

        assertFalse(principal.isEnabled());
        assertTrue(principal.isAccountNonExpired());
        assertTrue(principal.isAccountNonLocked());
        assertTrue(principal.isCredentialsNonExpired());
    }
}
