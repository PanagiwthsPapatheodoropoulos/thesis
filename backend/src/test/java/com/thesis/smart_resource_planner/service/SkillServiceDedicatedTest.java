package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.SkillDTO;
import com.thesis.smart_resource_planner.model.entity.Skill;
import com.thesis.smart_resource_planner.repository.SkillRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("SkillService Tests")
class SkillServiceDedicatedTest {

    @Mock
    private SkillRepository skillRepository;

    @Mock
    private ModelMapper modelMapper;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private SkillService skillService;

    private Skill testSkill;
    private SkillDTO testSkillDTO;
    private UUID skillId;

    @BeforeEach
    void setUp() {
        skillId = UUID.randomUUID();
        testSkill = new Skill();
        testSkill.setId(skillId);
        testSkill.setName("Java");
        testSkill.setDescription("Java Programming Language");

        testSkillDTO = new SkillDTO();
        testSkillDTO.setId(skillId);
        testSkillDTO.setName("Java");
        testSkillDTO.setDescription("Java Programming Language");
    }

    @Test
    @DisplayName("Should retrieve skill by ID successfully")
    void testGetSkillById_Success() {
        when(skillRepository.findById(skillId)).thenReturn(Optional.of(testSkill));
        when(modelMapper.map(testSkill, SkillDTO.class)).thenReturn(testSkillDTO);

        SkillDTO result = skillService.getSkillById(skillId);

        assertNotNull(result);
        assertEquals(testSkillDTO.getId(), result.getId());
        verify(skillRepository, times(1)).findById(skillId);
    }

    @Test
    @DisplayName("Should throw exception when skill not found")
    void testGetSkillById_NotFound() {
        when(skillRepository.findById(skillId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> skillService.getSkillById(skillId));
    }

    @Test
    @DisplayName("Should retrieve all skills successfully")
    void testGetAllSkills_Success() {
        List<Skill> skills = Arrays.asList(testSkill);
        List<SkillDTO> skillDTOs = Arrays.asList(testSkillDTO);

        when(skillRepository.findAll()).thenReturn(skills);
        when(modelMapper.map(testSkill, SkillDTO.class)).thenReturn(testSkillDTO);

        List<SkillDTO> result = skillService.getAllSkills();

        assertNotNull(result);
        assertEquals(1, result.size());
        verify(skillRepository, times(1)).findAll();
    }

    @Test
    @DisplayName("Should create skill successfully")
    void testCreateSkill_Success() {
        when(skillRepository.existsByName("Java")).thenReturn(false);
        when(modelMapper.map(eq(testSkillDTO), eq(Skill.class))).thenReturn(testSkill);
        when(skillRepository.save(any(Skill.class))).thenReturn(testSkill);
        when(modelMapper.map(eq(testSkill), eq(SkillDTO.class))).thenReturn(testSkillDTO);

        SkillDTO result = skillService.createSkill(testSkillDTO);

        assertNotNull(result);
        assertEquals(testSkillDTO.getName(), result.getName());
        verify(skillRepository, times(1)).save(any());
    }

    @Test
    @DisplayName("Should update skill successfully")
    void testUpdateSkill_Success() {
        testSkillDTO.setName("Java Advanced");

        when(skillRepository.findById(skillId)).thenReturn(Optional.of(testSkill));
        when(skillRepository.save(any())).thenReturn(testSkill);
        when(modelMapper.map(testSkill, SkillDTO.class)).thenReturn(testSkillDTO);

        SkillDTO result = skillService.updateSkill(skillId, testSkillDTO);

        assertNotNull(result);
        verify(skillRepository, times(1)).save(any());
    }

    @Test
    @DisplayName("Should delete skill successfully")
    void testDeleteSkill_Success() {
        when(skillRepository.existsById(skillId)).thenReturn(true);

        skillService.deleteSkill(skillId);

        verify(skillRepository, times(1)).deleteById(skillId);
    }
}
