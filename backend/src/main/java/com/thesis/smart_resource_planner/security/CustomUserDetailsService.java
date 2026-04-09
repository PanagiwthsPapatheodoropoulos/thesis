package com.thesis.smart_resource_planner.security;

import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Spring Security {@link UserDetailsService} implementation that loads user
 * authentication data from the database.
 *
 * <p>
 * Used by Spring Security's authentication infrastructure to look up a user
 * by username or e-mail during form-based login, and by the
 * {@link JwtAuthenticationFilter} to reload the {@link UserDetails} object
 * from a validated JWT token.
 * </p>
 */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    /**
     * Loads a {@link UserDetails} object by username or e-mail address.
     * Called automatically by Spring Security's authentication manager
     * during the login flow.
     *
     * @param usernameOrEmail the username or e-mail to look up
     * @return a fully populated {@link UserPrincipal}
     * @throws UsernameNotFoundException if no matching user is found in the
     *                                   database
     */
    @Override
    @Transactional
    public UserDetails loadUserByUsername(String usernameOrEmail) throws UsernameNotFoundException {
        User user = userRepository.findByUsernameOrEmail(usernameOrEmail, usernameOrEmail)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "User not found with username or email: " + usernameOrEmail));

        return UserPrincipal.create(user);
    }

    /**
     * Loads a {@link UserDetails} object by the user's UUID.
     * Used by the {@link JwtAuthenticationFilter} to resolve the principal
     * after the JWT token has been validated, without a second database
     * round-trip through the username lookup path.
     *
     * @param id UUID of the user to look up
     * @return a fully populated {@link UserPrincipal}
     * @throws UsernameNotFoundException if no user with the given ID exists
     */
    public UserDetails loadUserById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with id: " + id));

        return UserPrincipal.create(user);
    }

}
