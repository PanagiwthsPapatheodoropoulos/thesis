package com.thesis.smart_resource_planner.security;

import com.thesis.smart_resource_planner.model.entity.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;
import java.util.UUID;

/**
 * {@link UserDetails} implementation that wraps the application's
 * {@link com.thesis.smart_resource_planner.model.entity.User} entity.
 *
 * <p>
 * Instances are created via the {@link #create(User)} factory method
 * and stored in the Spring Security context after successful authentication.
 * They expose additional application-level fields (UUID, company ID, e-mail)
 * that are not part of the standard {@link UserDetails} contract.
 * </p>
 */
public class UserPrincipal implements UserDetails {

    private UUID id;
    private String username;
    private String email;
    private String password;
    private Collection<? extends GrantedAuthority> authorities;
    private boolean isActive;
    private UUID companyId;

    /**
     * Full constructor used by the {@link #create(User)} factory method.
     *
     * @param id          unique user identifier
     * @param username    login username
     * @param email       user's e-mail address
     * @param password    BCrypt-encoded password hash
     * @param authorities collection of granted roles (e.g. {@code ROLE_ADMIN})
     * @param isActive    whether the account is active/enabled
     * @param companyId   UUID of the company this user belongs to, or {@code null}
     */
    public UserPrincipal(UUID id, String username, String email, String password,
            Collection<? extends GrantedAuthority> authorities,
            boolean isActive, UUID companyId) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.password = password;
        this.authorities = authorities;
        this.isActive = isActive;
        this.companyId = companyId;
    }

    /**
     * Factory method that constructs a {@link UserPrincipal} from a
     * {@link com.thesis.smart_resource_planner.model.entity.User} entity.
     * Maps the user's role to a single Spring Security {@link GrantedAuthority}
     * with the {@code ROLE_} prefix convention.
     *
     * @param user the application user entity
     * @return a fully populated {@link UserPrincipal}
     */
    public static UserPrincipal create(User user) {
        Collection<GrantedAuthority> authorities = Collections.singletonList(
                new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));

        return new UserPrincipal(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getPasswordHash(),
                authorities,
                user.getIsActive(),
                user.getCompany() != null ? user.getCompany().getId() : null);
    }

    /** Returns the unique UUID of this user. */
    public UUID getId() {
        return id;
    }

    /**
     * Returns the UUID of the company this user belongs to, or {@code null} for
     * super-admins.
     */
    public UUID getCompanyId() {
        return companyId;
    }

    /** Returns the user's e-mail address. */
    public String getEmail() {
        return email;
    }

    /** {@inheritDoc} Returns the login username used for authentication. */
    @Override
    public String getUsername() {
        return username;
    }

    /** {@inheritDoc} Returns the BCrypt-encoded password hash. */
    @Override
    public String getPassword() {
        return password;
    }

    /** {@inheritDoc} Returns the collection of roles granted to this user. */
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    /** {@inheritDoc} Always returns {@code true}; account expiry is not used. */
    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    /** {@inheritDoc} Always returns {@code true}; account locking is not used. */
    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    /** {@inheritDoc} Always returns {@code true}; credential expiry is not used. */
    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    /**
     * {@inheritDoc} Returns whether the account is active (driven by the
     * {@code isActive} flag).
     */
    @Override
    public boolean isEnabled() {
        return isActive;
    }
}
