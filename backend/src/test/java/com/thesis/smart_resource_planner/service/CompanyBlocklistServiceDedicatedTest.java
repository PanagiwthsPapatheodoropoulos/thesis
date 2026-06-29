package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.exception.BadRequestException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.CompanyBlocklistCreateDTO;
import com.thesis.smart_resource_planner.model.dto.CompanyBlocklistEntryDTO;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.CompanyBlocklistEntry;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.CompanyBlocklistRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("CompanyBlocklistService Dedicated Tests")
class CompanyBlocklistServiceDedicatedTest {

    @Mock
    private CompanyBlocklistRepository blocklistRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private CompanyBlocklistService blocklistService;

    private UUID companyId;
    private UUID userId;
    private User testUser;
    private Company testCompany;
    private CompanyBlocklistCreateDTO createDTO;

    @BeforeEach
    void setUp() {
        companyId = UUID.randomUUID();
        userId = UUID.randomUUID();

        testCompany = new Company();
        testCompany.setId(companyId);
        testCompany.setName("Acme Corp");

        testUser = new User();
        testUser.setId(userId);
        testUser.setCompany(testCompany);

        createDTO = new CompanyBlocklistCreateDTO();
        createDTO.setEmail("blocked@example.com");
    }

    @Test
    @DisplayName("Should return true when email is blocked")
    void testIsBlocked_True() {
        when(blocklistRepository.existsByCompanyIdAndEmailIgnoreCase(companyId, "blocked@example.com"))
                .thenReturn(true);

        boolean result = blocklistService.isBlocked(companyId, "blocked@example.com");

        assertTrue(result);
        verify(blocklistRepository).existsByCompanyIdAndEmailIgnoreCase(companyId, "blocked@example.com");
    }

    @Test
    @DisplayName("Should return false when email or companyId is null")
    void testIsBlocked_NullArgs() {
        assertFalse(blocklistService.isBlocked(null, "blocked@example.com"));
        assertFalse(blocklistService.isBlocked(companyId, null));
    }

    @Test
    @DisplayName("Should retrieve blocklist for user's company")
    void testGetBlocklist_Success() {
        CompanyBlocklistEntry entry = new CompanyBlocklistEntry();
        entry.setId(UUID.randomUUID());
        entry.setCompany(testCompany);
        entry.setEmail("blocked@example.com");

        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(blocklistRepository.findByCompanyIdOrderByCreatedAtDesc(companyId))
                .thenReturn(Arrays.asList(entry));

        List<CompanyBlocklistEntryDTO> result = blocklistService.getBlocklist(userId);

        assertEquals(1, result.size());
        assertEquals("blocked@example.com", result.get(0).getEmail());
        verify(userRepository).findById(userId);
        verify(blocklistRepository).findByCompanyIdOrderByCreatedAtDesc(companyId);
    }

    @Test
    @DisplayName("Should throw BadRequestException on getBlocklist when user has no company")
    void testGetBlocklist_NoCompany() {
        testUser.setCompany(null);
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));

        assertThrows(BadRequestException.class, () -> blocklistService.getBlocklist(userId));
    }

    @Test
    @DisplayName("Should block email when not already blocked")
    void testBlockEmail_Success() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(blocklistRepository.existsByCompanyIdAndEmailIgnoreCase(companyId, "blocked@example.com"))
                .thenReturn(false);

        CompanyBlocklistEntry entry = new CompanyBlocklistEntry();
        entry.setId(UUID.randomUUID());
        entry.setEmail("blocked@example.com");
        entry.setCompany(testCompany);

        when(blocklistRepository.save(any(CompanyBlocklistEntry.class))).thenReturn(entry);

        CompanyBlocklistEntryDTO result = blocklistService.blockEmail(userId, createDTO);

        assertNotNull(result);
        assertEquals("blocked@example.com", result.getEmail());
        verify(blocklistRepository).save(any(CompanyBlocklistEntry.class));
    }

    @Test
    @DisplayName("Should throw BadRequestException when email already blocked")
    void testBlockEmail_AlreadyBlocked() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(blocklistRepository.existsByCompanyIdAndEmailIgnoreCase(companyId, "blocked@example.com"))
                .thenReturn(true);

        assertThrows(BadRequestException.class, () -> blocklistService.blockEmail(userId, createDTO));
        verify(blocklistRepository, never()).save(any(CompanyBlocklistEntry.class));
    }

    @Test
    @DisplayName("Should unblock entry successfully")
    void testUnblock_Success() {
        UUID entryId = UUID.randomUUID();
        CompanyBlocklistEntry entry = new CompanyBlocklistEntry();
        entry.setId(entryId);
        entry.setEmail("blocked@example.com");
        entry.setCompany(testCompany);

        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(blocklistRepository.findById(entryId)).thenReturn(Optional.of(entry));
        doNothing().when(blocklistRepository).delete(entry);

        blocklistService.unblock(userId, entryId);

        verify(blocklistRepository).delete(entry);
    }

    @Test
    @DisplayName("Should throw BadRequestException when trying to unblock entry of different company")
    void testUnblock_WrongCompany() {
        UUID entryId = UUID.randomUUID();
        Company otherCompany = new Company();
        otherCompany.setId(UUID.randomUUID());

        CompanyBlocklistEntry entry = new CompanyBlocklistEntry();
        entry.setId(entryId);
        entry.setEmail("blocked@example.com");
        entry.setCompany(otherCompany);

        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(blocklistRepository.findById(entryId)).thenReturn(Optional.of(entry));

        assertThrows(BadRequestException.class, () -> blocklistService.unblock(userId, entryId));
        verify(blocklistRepository, never()).delete(any(CompanyBlocklistEntry.class));
    }
}
